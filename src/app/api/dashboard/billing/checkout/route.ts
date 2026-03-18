import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BillingHistoryModel, BillingPlanModel, CompanyModel, UserModel, connectDb } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';
import { stripe } from '@/lib/stripe';
import { randomToken } from '@/lib/auth/crypto';

const schema = z.object({
  planId: z.string().trim().min(2),
  interval: z.enum(['month', 'year']),
});

async function resolveCompany(userId: string) {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user) return null;
  return CompanyModel.findOne({ id: user.companyId }).lean();
}

export async function POST(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const company = await resolveCompany(currentUserId);
    if (!company) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const plan = await BillingPlanModel.findOne({ id: parsed.data.planId, isActive: true }).lean();
    if (!plan) return NextResponse.json({ error: 'Plan not found', code: 'PLAN_NOT_FOUND' }, { status: 404 });

    const interval = parsed.data.interval;
    const monthlyAmount = Number(plan.priceUsd || 0);
    const yearlyDiscount = Math.min(100, Math.max(0, Number(plan.yearlyDiscountPercent || 0)));
    const unitAmount = interval === 'year'
      ? Math.round(monthlyAmount * 12 * (1 - yearlyDiscount / 100) * 100)
      : Math.round(monthlyAmount * 100);

    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    let stripeCustomerId = company.billing?.stripeCustomerId || '';
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: company.name,
        metadata: { companyId: company.id },
      });
      stripeCustomerId = customer.id;
      await CompanyModel.updateOne(
        { id: company.id },
        { $set: { 'billing.stripeCustomerId': stripeCustomerId, updatedAt: new Date() } }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: stripeCustomerId,
      success_url: `${appUrl}/dashboard/billing?success=1`,
      cancel_url: `${appUrl}/dashboard/billing?canceled=1`,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.max(0, unitAmount),
            product_data: {
              name: plan.name,
              description: plan.description || 'Delivoo subscription',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        companyId: company.id,
        planId: plan.id,
        planName: plan.name,
        interval,
      },
    });

    await BillingHistoryModel.create({
      id: randomToken(12),
      companyId: company.id,
      planId: plan.id,
      planName: plan.name,
      amount: interval === 'year' ? monthlyAmount * 12 * (1 - yearlyDiscount / 100) : monthlyAmount,
      currency: 'USD',
      interval,
      status: 'pending',
      stripeSessionId: session.id,
      createdBy: currentUserId,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session', code: 'CHECKOUT_FAILED' },
      { status: 500 }
    );
  }
}
