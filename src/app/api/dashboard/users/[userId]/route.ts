import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword, randomToken } from '@/lib/auth/crypto';
import { CompanyMemberModel, CompanyModel, connectDb, UserModel } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';

const MANAGEABLE_ROLES = ['admin', 'manager', 'stockManager', 'partnerManager', 'driver', 'accountant'] as const;

const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(2).max(80).optional(),
    lastName: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().max(40).optional(),
    role: z.enum(MANAGEABLE_ROLES).optional(),
    vehicleId: z.string().trim().optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No update payload provided' });

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

export async function PUT(request: Request, context: { params: Promise<{ userId: string }> }) {
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

    const { userId } = await context.params;
    const existing = await UserModel.findOne({ id: userId, companyId: company.id }).lean();
    if (!existing) {
      return NextResponse.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const payload = parsed.data;
    if (payload.isActive === false && userId === currentUserId) {
      return NextResponse.json({ error: 'Cannot deactivate own account', code: 'CANNOT_DEACTIVATE_SELF' }, { status: 400 });
    }

    let resolvedVehicleId: string | undefined;
    if (payload.role === 'driver') {
      const selectedVehicleId = payload.vehicleId?.trim() || '';
      if (selectedVehicleId) {
        const companyVehicleIds = Array.isArray(company.vehicles) ? company.vehicles.map((v) => v.id).filter(Boolean) : [];
        if (!companyVehicleIds.includes(selectedVehicleId)) {
          return NextResponse.json({ error: 'Invalid vehicle', code: 'INVALID_VEHICLE' }, { status: 400 });
        }
      }
      resolvedVehicleId = selectedVehicleId;
    } else if (payload.role) {
      resolvedVehicleId = '';
    } else if (payload.vehicleId !== undefined) {
      const selectedVehicleId = payload.vehicleId.trim();
      if (selectedVehicleId) {
        const companyVehicleIds = Array.isArray(company.vehicles) ? company.vehicles.map((v) => v.id).filter(Boolean) : [];
        if (!companyVehicleIds.includes(selectedVehicleId)) {
          return NextResponse.json({ error: 'Invalid vehicle', code: 'INVALID_VEHICLE' }, { status: 400 });
        }
      }
      resolvedVehicleId = selectedVehicleId;
    }

    const setPayload: Record<string, unknown> = { updatedAt: new Date() };
    if (payload.firstName !== undefined) setPayload.firstName = payload.firstName;
    if (payload.lastName !== undefined) setPayload.lastName = payload.lastName;
    if (payload.phone !== undefined) setPayload.phone = payload.phone;
    if (payload.role !== undefined) setPayload.role = payload.role;
    if (resolvedVehicleId !== undefined) setPayload.vehicleId = resolvedVehicleId;
    if (payload.isActive !== undefined) setPayload.isActive = payload.isActive;
    if (payload.password !== undefined) setPayload.passwordHash = hashPassword(payload.password);

    await UserModel.updateOne({ id: userId, companyId: company.id }, { $set: setPayload });

    if (payload.role !== undefined || payload.isActive !== undefined) {
      await CompanyMemberModel.updateOne(
        { userId, companyId: company.id },
        {
          $set: {
            ...(payload.role !== undefined ? { role: payload.role } : {}),
            ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
            updatedAt: new Date(),
          },
          $setOnInsert: {
            id: randomToken(12),
            userId,
            companyId: company.id,
            role: payload.role || existing.role,
            isActive: payload.isActive ?? existing.isActive,
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    const updated = await UserModel.findOne({ id: userId, companyId: company.id }).lean();
    if (!updated) {
      return NextResponse.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'User updated successfully.',
      user: mapDashboardUser(updated),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update user', code: 'USER_UPDATE_FAILED' },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ userId: string }> }) {
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

    const { userId } = await context.params;
    if (userId === currentUserId) {
      return NextResponse.json({ error: 'Cannot delete own account', code: 'CANNOT_DELETE_SELF' }, { status: 400 });
    }

    const existing = await UserModel.findOne({ id: userId, companyId: company.id }).lean();
    if (!existing) {
      return NextResponse.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, { status: 404 });
    }

    await UserModel.deleteOne({ id: userId, companyId: company.id });
    await CompanyMemberModel.deleteOne({ userId, companyId: company.id });

    return NextResponse.json({ message: 'User deleted successfully.' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete user', code: 'USER_DELETE_FAILED' },
      { status: 500 }
    );
  }
}
