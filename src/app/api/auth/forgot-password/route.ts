import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDb, UserModel } from '@/lib/auth/db';
import { createAuthToken } from '@/lib/auth/tokens';
import { buildResetPasswordTemplate } from '@/lib/auth/email-templates';
import { sendMailWithMailjet } from '@/lib/auth/mailjet';

const schema = z.object({
  email: z.string().email(),
  locale: z.enum(['fr', 'en']).optional(),
});

export async function POST(request: Request) {
  try {
    await connectDb();

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email', code: 'INVALID_EMAIL' }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const locale = parsed.data.locale === 'fr' ? 'fr' : 'en';
    const user = await UserModel.findOne({ email }).lean();

    if (user) {
      const resetToken = await createAuthToken(user.id, 'reset_password');
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const resetLink = `${appUrl}/auth/reset-password?token=${resetToken}`;
      const emailTemplate = buildResetPasswordTemplate({
        firstName: user.firstName || 'there',
        resetLink,
        locale,
      });

      await sendMailWithMailjet({
        to: email,
        subject: emailTemplate.subject,
        text: emailTemplate.text,
        html: emailTemplate.html,
      });
    }

    return NextResponse.json({ message: 'If this email exists, a reset link has been sent.' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request', code: 'FORGOT_PASSWORD_FAILED' },
      { status: 500 }
    );
  }
}
