import { cookies } from 'next/headers';
import { hashToken, randomToken } from './crypto';
import { connectDb, SessionModel } from './db';

export const SESSION_COOKIE_NAME = 'deliverly_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  await connectDb();

  const token = randomToken(32);
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  await SessionModel.deleteMany({ expiresAt: { $lte: now } });
  await SessionModel.create({
    id: randomToken(12),
    userId,
    tokenHash,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function getCurrentSessionUserId(): Promise<string | null> {
  await connectDb();

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const now = new Date();

  await SessionModel.deleteMany({ expiresAt: { $lte: now } });
  const current = await SessionModel.findOne({ tokenHash, expiresAt: { $gt: now } }).lean();

  return current?.userId || null;
}

export async function clearCurrentSession(): Promise<void> {
  await connectDb();

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    await SessionModel.deleteOne({ tokenHash });
  }

  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}
