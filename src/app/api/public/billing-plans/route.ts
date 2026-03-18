import { NextResponse } from 'next/server';
import { BillingPlanModel, connectDb } from '@/lib/auth/db';

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
    const plans = await BillingPlanModel.find({ isActive: true }).sort({ priceUsd: 1, createdAt: 1 }).lean();
    const activePlans = plans.map(mapPlan);
    const enterprise =
      activePlans.find((plan) => plan.name?.toLowerCase().includes('enterprise')) ||
      activePlans.find((plan) => plan.name?.toLowerCase().includes('entreprise')) ||
      activePlans.find((plan) => Number(plan.priceUsd || 0) === 0) ||
      null;
    const fallbackEnterprise = !enterprise && activePlans.length > 2 ? activePlans[activePlans.length - 1] : null;
    const enterprisePlan = enterprise || fallbackEnterprise;
    const primaryPlans = activePlans.filter((plan) => plan !== enterprisePlan).slice(0, 2);

    return NextResponse.json({ plans: primaryPlans, enterprisePlan });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch plans', code: 'PLANS_FETCH_FAILED' },
      { status: 500 }
    );
  }
}
