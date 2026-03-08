import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword, randomToken } from '@/lib/auth/crypto';
import { CompanyMemberModel, CompanyModel, connectDb, UserModel } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';

const MANAGEABLE_ROLES = ['admin', 'manager', 'stockManager', 'partnerManager', 'driver', 'accountant'] as const;

const createUserSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).optional(),
  role: z.enum(MANAGEABLE_ROLES),
  vehicleId: z.string().trim().optional(),
  password: z.string().min(8).max(128),
});

type ResolvedCompany = {
  id: string;
  vehicles?: Array<{ id?: string; isActive?: boolean }>;
};

async function resolveCurrentCompany(userId: string): Promise<ResolvedCompany | null> {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user) return null;
  const company = await CompanyModel.findOne({ id: user.companyId }).lean();
  if (!company) return null;
  return company;
}

function mapDashboardUser(user: any) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone || '',
    vehicleId: user.vehicleId || '',
    role: user.role,
    isActive: user.isActive !== false,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function GET(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const company = await resolveCurrentCompany(currentUserId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '10') || 10));
    const search = (searchParams.get('search') || '').trim();
    const requestedRole = (searchParams.get('role') || '').trim();
    const roleFilter = MANAGEABLE_ROLES.includes(requestedRole as (typeof MANAGEABLE_ROLES)[number])
      ? requestedRole
      : '';

    const query: Record<string, unknown> = { companyId: company.id };
    if (roleFilter) {
      query.role = roleFilter;
    }
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }, { phone: regex }];
    }

    const [total, users] = await Promise.all([
      UserModel.countDocuments(query),
      UserModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return NextResponse.json({
      users: users.map(mapDashboardUser),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch users', code: 'USERS_FETCH_FAILED' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const company = await resolveCurrentCompany(currentUserId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const payload = parsed.data;
    let vehicleId = '';
    if (payload.role === 'driver' && payload.vehicleId?.trim()) {
      const selectedVehicleId = payload.vehicleId.trim();
      const companyVehicleIds = Array.isArray(company.vehicles) ? company.vehicles.map((v) => v.id).filter(Boolean) : [];
      if (!companyVehicleIds.includes(selectedVehicleId)) {
        return NextResponse.json({ error: 'Invalid vehicle', code: 'INVALID_VEHICLE' }, { status: 400 });
      }
      vehicleId = selectedVehicleId;
    }
    const email = payload.email.toLowerCase().trim();
    const existing = await UserModel.findOne({ email }).lean();
    if (existing) {
      return NextResponse.json({ error: 'Email already in use', code: 'EMAIL_ALREADY_IN_USE' }, { status: 409 });
    }

    const newUserId = randomToken(12);
    const now = new Date();

    const created = await UserModel.create({
      id: newUserId,
      email,
      passwordHash: hashPassword(payload.password),
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone || '',
      vehicleId,
      companyId: company.id,
      role: payload.role,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await CompanyMemberModel.create({
      id: randomToken(12),
      companyId: company.id,
      userId: newUserId,
      role: payload.role,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      {
        message: 'User created successfully.',
        user: mapDashboardUser(created.toObject()),
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create user', code: 'USER_CREATE_FAILED' },
      { status: 500 }
    );
  }
}
