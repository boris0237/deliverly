import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDb, UserModel } from '@/lib/auth/db';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { consumeAuthToken } from '@/lib/auth/tokens';

const schema = z.object({ token: z.string().min(20) });

export async function POST(request: Request) {
  try {
    await connectDb();

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const consumed = await consumeAuthToken(parsed.data.token, 'verify_email');
    if (!consumed) {
      return NextResponse.json({ error: 'Invalid or expired token', code: 'INVALID_OR_EXPIRED_TOKEN' }, { status: 400 });
    }

    await UserModel.updateOne(
      { id: consumed.userId },
      {
        $set: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    const { token, expiresAt } = await createSession(consumed.userId);
    await setSessionCookie(token, expiresAt);

    return NextResponse.json({ message: 'Email verified successfully.', redirectTo: '/dashboard' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify email', code: 'VERIFY_EMAIL_FAILED' },
      { status: 500 }
    );
  }
}
