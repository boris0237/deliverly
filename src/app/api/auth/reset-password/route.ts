import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword } from '@/lib/auth/crypto';
import { connectDb, SessionModel, UserModel } from '@/lib/auth/db';
import { consumeAuthToken } from '@/lib/auth/tokens';

const schema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    await connectDb();

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const consumed = await consumeAuthToken(parsed.data.token, 'reset_password');
    if (!consumed) {
      return NextResponse.json({ error: 'Invalid or expired token', code: 'INVALID_OR_EXPIRED_TOKEN' }, { status: 400 });
    }

    const passwordHash = hashPassword(parsed.data.password);

    await UserModel.updateOne({ id: consumed.userId }, { $set: { passwordHash, updatedAt: new Date() } });
    await SessionModel.deleteMany({ userId: consumed.userId });

    return NextResponse.json({ message: 'Password updated successfully.' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reset password', code: 'RESET_PASSWORD_FAILED' },
      { status: 500 }
    );
  }
}
