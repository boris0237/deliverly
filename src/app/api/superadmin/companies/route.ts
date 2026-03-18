import { NextResponse } from 'next/server';
import { CompanyModel, UserModel, connectDb } from '@/lib/auth/db';
import { isValidObjectId } from 'mongoose';
import { getCurrentSessionUserId } from '@/lib/auth/session';

async function ensureSuperAdmin(userId: string) {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user) return { ok: false, status: 404, error: 'User not found', code: 'USER_NOT_FOUND' } as const;
  if (user.role !== 'superAdmin') {
    return { ok: false, status: 403, error: 'Forbidden', code: 'FORBIDDEN' } as const;
  }
  return { ok: true, user } as const;
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
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(50, Math.max(6, Number(searchParams.get('pageSize') || 12)));

    const query: Record<string, unknown> = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const or: Record<string, unknown>[] = [{ name: regex }, { id: regex }];
      if (isValidObjectId(search)) {
        or.push({ _id: search });
      }
      query.$or = or;
    }

    const [total, companies] = await Promise.all([
      CompanyModel.countDocuments(query),
      CompanyModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return NextResponse.json({
      total,
      page,
      pageSize,
      companies: companies.map((company) => ({
        id: company.id || String(company._id),
        name: company.name,
        logo: company.logo || '',
        ownerUserId: company.ownerUserId || '',
        isActive: company.isActive !== false,
        createdAt: company.createdAt,
        billing: {
          planId: company.billing?.planId || '',
          planName: company.billing?.planName || '',
          status: company.billing?.status || 'trialing',
          interval: company.billing?.interval || 'trial',
          trialEndsAt: company.billing?.trialEndsAt || null,
          currentPeriodStart: company.billing?.currentPeriodStart || null,
          currentPeriodEnd: company.billing?.currentPeriodEnd || null,
        },
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch companies', code: 'COMPANIES_FETCH_FAILED' },
      { status: 500 }
    );
  }
}
