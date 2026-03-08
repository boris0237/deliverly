import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPassword } from '@/lib/auth/crypto';
import { connectDb, UserModel } from '@/lib/auth/db';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { toPublicUser } from '@/lib/auth/user';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    await connectDb();

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const password = parsed.data.password;

    const user = await UserModel.findOne({ email }).lean();

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }, { status: 401 });
    }

    if (!user.emailVerified) {
      return NextResponse.json({ error: 'Please verify your email before logging in.', code: 'EMAIL_NOT_VERIFIED' }, { status: 403 });
    }

    await UserModel.updateOne(
      { id: user.id },
      { $set: { lastLoginAt: new Date(), updatedAt: new Date() } }
    );

    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);

    return NextResponse.json({ user: toPublicUser(user) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Login failed', code: 'LOGIN_FAILED' },
      { status: 500 }
    );
  }
}
