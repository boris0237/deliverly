import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BillingPlanModel, UserModel, connectDb } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';

const planSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional().or(z.literal('')),
  priceUsd: z.number().min(0),
  yearlyDiscountPercent: z.number().min(0).max(100),
  limits: z.object({
    partners: z.number().int().min(0),
    drivers: z.number().int().min(0),
    users: z.number().int().min(0),
  }),
  features: z.object({
    tracking: z.boolean(),
    financialReports: z.boolean(),
    whatsappAssistant: z.boolean(),
  }),
  isActive: z.boolean().optional(),
});

async function ensureSuperAdmin(userId: string) {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user) return { ok: false, status: 404, error: 'User not found', code: 'USER_NOT_FOUND' } as const;
  if (user.role !== 'superAdmin') {
    return { ok: false, status: 403, error: 'Forbidden', code: 'FORBIDDEN' } as const;
  }
  return { ok: true, user } as const;
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
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

export async function PUT(request: Request, context: { params: Promise<{ planId: string }> }) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const auth = await ensureSuperAdmin(currentUserId);
    if (!auth.ok) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });

    const { planId } = await context.params;
    const existing = await BillingPlanModel.findOne({ id: planId }).lean();
    if (!existing) return NextResponse.json({ error: 'Plan not found', code: 'PLAN_NOT_FOUND' }, { status: 404 });

    const body = await request.json();
    const parsed = planSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const payload = parsed.data;
    const updated = await BillingPlanModel.findOneAndUpdate(
      { id: planId },
      {
        $set: {
          name: payload.name,
          description: payload.description || '',
          priceUsd: payload.priceUsd,
          yearlyDiscountPercent: payload.yearlyDiscountPercent,
          limits: payload.limits,
          features: payload.features,
          isActive: payload.isActive !== false,
          updatedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    return NextResponse.json({ plan: mapPlan(updated) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update plan', code: 'PLAN_UPDATE_FAILED' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ planId: string }> }) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const auth = await ensureSuperAdmin(currentUserId);
    if (!auth.ok) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });

    const { planId } = await context.params;
    const existing = await BillingPlanModel.findOne({ id: planId }).lean();
    if (!existing) return NextResponse.json({ error: 'Plan not found', code: 'PLAN_NOT_FOUND' }, { status: 404 });

    await BillingPlanModel.updateOne({ id: planId }, { $set: { isActive: false, updatedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete plan', code: 'PLAN_DELETE_FAILED' },
      { status: 500 }
    );
  }
}
