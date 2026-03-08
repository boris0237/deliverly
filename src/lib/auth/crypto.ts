import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';

export function randomToken(size = 32): string {
  return randomBytes(size).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;

  const computedHash = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(hash, 'hex');

  if (computedHash.length !== storedBuffer.length) return false;
  return timingSafeEqual(computedHash, storedBuffer);
}
