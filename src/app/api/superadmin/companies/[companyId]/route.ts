import { NextResponse } from 'next/server';
import { CompanyModel, DeliveryModel, PartnerModel, UserModel, connectDb } from '@/lib/auth/db';
import { Types, isValidObjectId } from 'mongoose';
import { getCurrentSessionUserId } from '@/lib/auth/session';

async function ensureSuperAdmin(userId: string) {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user) return { ok: false, status: 404, error: 'User not found', code: 'USER_NOT_FOUND' } as const;
  if (user.role !== 'superAdmin') {
    return { ok: false, status: 403, error: 'Forbidden', code: 'FORBIDDEN' } as const;
  }
  return { ok: true, user } as const;
}

export async function GET(_: Request, context: { params: Promise<{ companyId: string }> }) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const auth = await ensureSuperAdmin(currentUserId);
    if (!auth.ok) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });

    const { companyId } = await context.params;
    const query: Record<string, unknown> = { id: companyId };
    if (isValidObjectId(companyId)) {
      query.$or = [{ id: companyId }, { _id: new Types.ObjectId(companyId) }];
    }
    const company = await CompanyModel.findOne(query).lean();
    if (!company) {
      return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });
    }

    const [owner, usersCount, driversCount, partnersCount, deliveriesCount] = await Promise.all([
      company.ownerUserId ? UserModel.findOne({ id: company.ownerUserId }).lean() : null,
      UserModel.countDocuments({ companyId }),
      UserModel.countDocuments({ companyId, role: 'driver' }),
      PartnerModel.countDocuments({ companyId }),
      DeliveryModel.countDocuments({ companyId }),
    ]);

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        logo: company.logo || '',
        address: company.address || '',
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
        owner: owner
          ? { id: owner.id, firstName: owner.firstName || '', lastName: owner.lastName || '', email: owner.email || '' }
          : null,
        stats: {
          users: usersCount,
          drivers: driversCount,
          partners: partnersCount,
          deliveries: deliveriesCount,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch company', code: 'COMPANY_FETCH_FAILED' },
      { status: 500 }
    );
  }
}
