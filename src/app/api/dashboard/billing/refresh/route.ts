import { NextResponse } from 'next/server';
import { BillingHistoryModel, BillingPlanModel, CompanyModel, UserModel, connectDb } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';
import { stripe } from '@/lib/stripe';

async function resolveCompany(userId: string) {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user) return null;
  return CompanyModel.findOne({ id: user.companyId }).lean();
}

export async function POST() {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const company = await resolveCompany(currentUserId);
    if (!company) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const latestPending = await BillingHistoryModel.findOne({
      companyId: company.id,
      status: 'pending',
      stripeSessionId: { $ne: '' },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!latestPending?.stripeSessionId) {
      return NextResponse.json({ updated: false });
    }

    const session = await stripe.checkout.sessions.retrieve(latestPending.stripeSessionId);
    const paymentStatus = session.payment_status;
    if (paymentStatus !== 'paid') {
      return NextResponse.json({ updated: false, status: paymentStatus });
    }

    const now = new Date();
    const metadata = session.metadata || {};
    const planId = metadata.planId || latestPending.planId;
    const interval = (metadata.interval as 'month' | 'year') || latestPending.interval || 'month';
    const plan = planId ? await BillingPlanModel.findOne({ id: planId }).lean() : null;

    const periodEnd = new Date(now);
    if (interval === 'year') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await BillingHistoryModel.updateOne(
      { id: latestPending.id },
      {
        $set: {
          status: 'paid',
          stripePaymentIntentId: session.payment_intent?.toString() || latestPending.stripePaymentIntentId || '',
          paidAt: now,
        },
      }
    );

    if (planId) {
      await CompanyModel.updateOne(
        { id: company.id },
        {
          $set: {
            'billing.planId': planId,
            'billing.planName': plan?.name || latestPending.planName,
            'billing.status': 'active',
            'billing.interval': interval,
            'billing.currentPeriodStart': now,
            'billing.currentPeriodEnd': periodEnd,
            'billing.trialEndsAt': null,
            updatedAt: now,
          },
        }
      );
    }

    return NextResponse.json({ updated: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh billing', code: 'BILLING_REFRESH_FAILED' },
      { status: 500 }
    );
  }
}
