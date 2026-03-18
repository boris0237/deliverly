import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomToken } from '@/lib/auth/crypto';
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

export async function GET(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const auth = await ensureSuperAdmin(currentUserId);
    if (!auth.ok) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const query: Record<string, unknown> = { isActive: true };
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: regex }, { description: regex }];
    }

    const plans = await BillingPlanModel.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ plans: plans.map(mapPlan) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch plans', code: 'PLANS_FETCH_FAILED' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const auth = await ensureSuperAdmin(currentUserId);
    if (!auth.ok) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });

    const body = await request.json();
    const parsed = planSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const payload = parsed.data;
    const now = new Date();
    const created = await BillingPlanModel.create({
      id: randomToken(12),
      name: payload.name,
      description: payload.description || '',
      priceUsd: payload.priceUsd,
      yearlyDiscountPercent: payload.yearlyDiscountPercent,
      limits: payload.limits,
      features: payload.features,
      isActive: payload.isActive !== false,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ plan: mapPlan(created.toObject()) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create plan', code: 'PLAN_CREATE_FAILED' },
      { status: 500 }
    );
  }
}
