import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CompanyModel, UserModel, connectDb } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';
import { hashPassword, verifyPassword } from '@/lib/auth/crypto';
import { uploadToCloudinary } from '@/lib/uploads/cloudinary';

const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(2).max(80).optional(),
    lastName: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().max(40).optional(),
    currentPassword: z.string().min(8).max(128).optional(),
    newPassword: z.string().min(8).max(128).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No update payload provided' });

function mapProfile(user: any, companyName = '') {
  return {
    id: user.id,
    firstName: String(user.firstName || ''),
    lastName: String(user.lastName || ''),
    email: String(user.email || ''),
    phone: String(user.phone || ''),
    avatar: String(user.avatar || ''),
    role: String(user.role || ''),
    companyId: String(user.companyId || ''),
    companyName: String(companyName || ''),
    isActive: user.isActive !== false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt || null,
  };
}

export async function GET() {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const user = await UserModel.findOne({ id: currentUserId }).lean();
    if (!user?.companyId) {
      return NextResponse.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, { status: 404 });
    }
    const company = await CompanyModel.findOne({ id: user.companyId }).lean();
    if (!company) {
      return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ profile: mapProfile(user, String(company.name || '')) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load profile', code: 'PROFILE_FETCH_FAILED' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const existing = await UserModel.findOne({ id: currentUserId }).lean();
    if (!existing?.companyId) {
      return NextResponse.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, { status: 404 });
    }
    const company = await CompanyModel.findOne({ id: existing.companyId }).lean();
    if (!company) {
      return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') || '';
    let avatarFile: File | null = null;
    let body: Record<string, unknown>;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const maybeFile = formData.get('avatarFile');
      avatarFile = maybeFile instanceof File && maybeFile.size > 0 ? maybeFile : null;
      body = {
        firstName: String(formData.get('firstName') || '').trim(),
        lastName: String(formData.get('lastName') || '').trim(),
        phone: String(formData.get('phone') || '').trim(),
        currentPassword: String(formData.get('currentPassword') || ''),
        newPassword: String(formData.get('newPassword') || ''),
      };
      Object.keys(body).forEach((key) => {
        if (typeof body[key] === 'string' && String(body[key]).trim() === '') {
          delete body[key];
        }
      });
    } else {
      body = await request.json();
    }

    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const payload = parsed.data;
    const wantsPasswordChange = Boolean(payload.newPassword);
    if (wantsPasswordChange) {
      if (!payload.currentPassword) {
        return NextResponse.json({ error: 'Current password required', code: 'CURRENT_PASSWORD_REQUIRED' }, { status: 400 });
      }
      const isValidCurrentPassword = verifyPassword(payload.currentPassword, String(existing.passwordHash || ''));
      if (!isValidCurrentPassword) {
        return NextResponse.json({ error: 'Invalid current password', code: 'INVALID_CURRENT_PASSWORD' }, { status: 400 });
      }
    }

    const setPayload: Record<string, unknown> = { updatedAt: new Date() };
    if (payload.firstName !== undefined) setPayload.firstName = payload.firstName;
    if (payload.lastName !== undefined) setPayload.lastName = payload.lastName;
    if (payload.phone !== undefined) setPayload.phone = payload.phone;
    if (avatarFile) {
      const uploaded = await uploadToCloudinary(avatarFile, {
        folder: `deliverly/user-avatars/${existing.companyId}`,
        resourceType: 'image',
      });
      setPayload.avatar = uploaded.secureUrl;
    }
    if (wantsPasswordChange && payload.newPassword) {
      setPayload.passwordHash = hashPassword(payload.newPassword);
    }

    await UserModel.updateOne({ id: currentUserId }, { $set: setPayload });
    const updated = await UserModel.findOne({ id: currentUserId }).lean();
    if (!updated) {
      return NextResponse.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Profile updated successfully.',
      profile: mapProfile(updated, String(company.name || '')),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update profile', code: 'PROFILE_UPDATE_FAILED' },
      { status: 500 }
    );
  }
}
