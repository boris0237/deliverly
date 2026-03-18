import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { BillingHistoryModel, BillingPlanModel, CompanyModel, connectDb } from '@/lib/auth/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing webhook signature', code: 'INVALID_WEBHOOK' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid webhook payload', code: 'INVALID_WEBHOOK' },
      { status: 400 }
    );
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};
    const companyId = metadata.companyId || '';
    const planId = metadata.planId || '';
    const interval = (metadata.interval as 'month' | 'year') || 'month';

    if (companyId && planId) {
      await connectDb();
      const plan = await BillingPlanModel.findOne({ id: planId }).lean();
      const now = new Date();
      const periodEnd = new Date(now);
      if (interval === 'year') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      await CompanyModel.updateOne(
        { id: companyId },
        {
          $set: {
            'billing.planId': plan?.id || planId,
            'billing.planName': plan?.name || metadata.planName || '',
            'billing.status': 'active',
            'billing.interval': interval,
            'billing.currentPeriodStart': now,
            'billing.currentPeriodEnd': periodEnd,
            'billing.trialEndsAt': null,
            'billing.stripeSubscriptionId': session.subscription?.toString() || '',
            updatedAt: now,
          },
        }
      );

      await BillingHistoryModel.updateOne(
        { stripeSessionId: session.id },
        {
          $set: {
            status: 'paid',
            stripePaymentIntentId: session.payment_intent?.toString() || '',
            paidAt: now,
          },
        }
      );
    }
  }

  return NextResponse.json({ received: true });
}
