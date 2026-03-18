import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword, randomToken } from '@/lib/auth/crypto';
import { BillingPlanModel, CompanyMemberModel, CompanyModel, connectDb, UserModel } from '@/lib/auth/db';
import { createAuthToken } from '@/lib/auth/tokens';
import { buildVerifyEmailTemplate } from '@/lib/auth/email-templates';
import { sendMailWithMailjet } from '@/lib/auth/mailjet';
import { toPublicUser } from '@/lib/auth/user';

const schema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().optional(),
  locale: z.enum(['fr', 'en']).optional(),
});

export async function POST(request: Request) {
  let createdCompanyId: string | null = null;
  let createdUserId: string | null = null;

  try {
    await connectDb();

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const payload = parsed.data;
    const email = payload.email.toLowerCase().trim();
    const locale = payload.locale === 'fr' ? 'fr' : 'en';
    const companyName = payload.companyName?.trim() || `${payload.firstName.trim()}'s Company`;
    const existing = await UserModel.findOne({ email }).lean();

    if (existing) {
      return NextResponse.json({ error: 'Email already in use', code: 'EMAIL_ALREADY_IN_USE' }, { status: 409 });
    }

    const companyId = randomToken(12);
    const userId = randomToken(12);
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const starterPlan = await BillingPlanModel.findOne({ isActive: true, name: /starter/i }).lean();

    await CompanyModel.create({
      id: companyId,
      name: companyName,
      ownerUserId: null,
      logo: '',
      address: '',
      businessHours: {
        open: '09:00',
        close: '18:00',
        days: [1, 2, 3, 4, 5],
      },
      billing: {
        planId: starterPlan?.id || '',
        planName: starterPlan?.name || 'Starter',
        status: 'trialing',
        interval: 'trial',
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
      },
      isActive: true,
    });
    createdCompanyId = companyId;

    const newUser = await UserModel.create({
      id: userId,
      email,
      passwordHash: hashPassword(payload.password),
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      companyId,
      role: 'admin',
      isActive: true,
      emailVerified: false,
    });
    createdUserId = userId;

    await CompanyModel.updateOne({ id: companyId }, { $set: { ownerUserId: userId, updatedAt: new Date() } });
    await CompanyMemberModel.create({
      id: randomToken(12),
      companyId,
      userId,
      role: 'admin',
      isActive: true,
    });

    const verifyToken = await createAuthToken(newUser.id, 'verify_email');
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const verificationLink = `${appUrl}/auth/verify-email?token=${verifyToken}`;
    const emailTemplate = buildVerifyEmailTemplate({
      firstName: payload.firstName.trim(),
      verificationLink,
      locale,
    });

    await sendMailWithMailjet({
      to: email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });

    return NextResponse.json({
      message: 'Registration successful. Check your email to verify your account.',
      user: toPublicUser(newUser.toObject()),
    });
  } catch (error) {
    // Best-effort cleanup when registration fails after creating partial records.
    if (createdUserId) {
      await UserModel.deleteOne({ id: createdUserId }).catch(() => null);
      await CompanyMemberModel.deleteMany({ userId: createdUserId }).catch(() => null);
    }
    if (createdCompanyId) {
      await CompanyModel.deleteOne({ id: createdCompanyId }).catch(() => null);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Registration failed', code: 'REGISTRATION_FAILED' },
      { status: 500 }
    );
  }
}
