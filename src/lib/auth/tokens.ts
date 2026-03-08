import { hashToken, randomToken } from './crypto';
import { AuthTokenModel, connectDb } from './db';
import type { AuthTokenType } from './types';

const TOKEN_DURATIONS_MS: Record<AuthTokenType, number> = {
  verify_email: 1000 * 60 * 60 * 24,
  reset_password: 1000 * 60 * 30,
};

export async function createAuthToken(userId: string, type: AuthTokenType): Promise<string> {
  await connectDb();

  const token = randomToken(32);
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_DURATIONS_MS[type]);

  await AuthTokenModel.deleteMany({ userId, type });
  await AuthTokenModel.create({
    id: randomToken(12),
    userId,
    type,
    tokenHash,
    expiresAt,
  });

  return token;
}

export async function consumeAuthToken(token: string, type: AuthTokenType): Promise<{ userId: string } | null> {
  await connectDb();

  const tokenHash = hashToken(token);
  const now = new Date();

  await AuthTokenModel.deleteMany({ expiresAt: { $lte: now } });

  const matched = await AuthTokenModel.findOneAndDelete({ tokenHash, type, expiresAt: { $gt: now } }).lean();

  return matched ? { userId: matched.userId } : null;
}
