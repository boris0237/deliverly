import { NextResponse } from 'next/server';
import { BillingHistoryModel, BillingPlanModel, CompanyModel, PartnerModel, UserModel, connectDb } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';

type ResolvedCompany = {
  id: string;
  name: string;
  billing?: {
    planId?: string;
    planName?: string;
    status?: string;
    interval?: string;
    trialEndsAt?: Date | null;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
  };
};

async function resolveCompany(userId: string): Promise<ResolvedCompany | null> {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user) return null;
  const company = await CompanyModel.findOne({ id: user.companyId }).lean();
  if (!company) return null;
  return {
    id: company.id,
    name: company.name,
    billing: company.billing
      ? {
          planId: company.billing.planId || '',
          planName: company.billing.planName || '',
          status: company.billing.status || '',
          interval: company.billing.interval || '',
          trialEndsAt: company.billing.trialEndsAt || null,
          currentPeriodStart: company.billing.currentPeriodStart || null,
          currentPeriodEnd: company.billing.currentPeriodEnd || null,
        }
      : undefined,
  };
}

function mapPlan(plan: any) {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description || '',
    priceUsd: Number(plan.priceUsd || 0),
    yearlyDiscountPercent: Number(plan.yearlyDiscountPercent || 0),
    limits: {
      partners: Number(plan.limits?.partners || 0),
      drivers: Number(plan.limits?.drivers || 0),
      users: Number(plan.limits?.users || 0),
    },
    features: {
      tracking: plan.features?.tracking !== false,
      financialReports: plan.features?.financialReports !== false,
      whatsappAssistant: plan.features?.whatsappAssistant === true,
    },
    isActive: plan.isActive !== false,
  };
}

export async function GET() {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const company = await resolveCompany(currentUserId);
    if (!company) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const [partnersCount, usersCount, driversCount, plans, history] = await Promise.all([
      PartnerModel.countDocuments({ companyId: company.id, isActive: true }),
      UserModel.countDocuments({ companyId: company.id }),
      UserModel.countDocuments({ companyId: company.id, role: 'driver' }),
      BillingPlanModel.find({ isActive: true }).sort({ priceUsd: 1, createdAt: 1 }).lean(),
      BillingHistoryModel.find({ companyId: company.id }).sort({ createdAt: -1 }).limit(50).lean(),
    ]);

    const activePlans = plans.map(mapPlan);
    const enterprise =
      activePlans.find((plan) => plan.name?.toLowerCase().includes('enterprise')) ||
      activePlans.find((plan) => plan.name?.toLowerCase().includes('entreprise')) ||
      activePlans.find((plan) => Number(plan.priceUsd || 0) === 0) ||
      null;
    const fallbackEnterprise = !enterprise && activePlans.length > 2 ? activePlans[activePlans.length - 1] : null;
    const enterprisePlan = enterprise || fallbackEnterprise;
    const primaryPlans = activePlans.filter((plan) => plan !== enterprisePlan).slice(0, 2);

    const currentPlan = company.billing?.planId
      ? activePlans.find((plan) => plan.id === company.billing?.planId) || null
      : null;

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        billing: {
          planId: company.billing?.planId || '',
          planName: company.billing?.planName || currentPlan?.name || 'Starter',
          status: company.billing?.status || 'trialing',
          interval: company.billing?.interval || 'trial',
          trialEndsAt: company.billing?.trialEndsAt || null,
          currentPeriodStart: company.billing?.currentPeriodStart || null,
          currentPeriodEnd: company.billing?.currentPeriodEnd || null,
        },
      },
      usage: {
        partners: partnersCount,
        users: usersCount,
        drivers: driversCount,
      },
      plans: primaryPlans,
      enterprisePlan,
      history: history.map((entry) => ({
        id: entry.id,
        planName: entry.planName,
        amount: Number(entry.amount || 0),
        currency: entry.currency || 'USD',
        interval: entry.interval || 'month',
        status: entry.status || 'pending',
        paidAt: entry.paidAt || null,
        createdAt: entry.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch billing', code: 'BILLING_FETCH_FAILED' },
      { status: 500 }
    );
  }
}
