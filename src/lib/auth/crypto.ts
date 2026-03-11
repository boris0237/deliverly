import 'server-only';
import { createRequire } from 'module';

type NodeCryptoModule = {
  randomBytes: (size: number) => { toString: (encoding: 'hex') => string };
  createHash: (algorithm: 'sha256') => { update: (value: string) => { digest: (encoding: 'hex') => string } };
  scryptSync: (password: string, salt: string, keylen: number) => Buffer;
  timingSafeEqual: (a: Buffer, b: Buffer) => boolean;
};

const require = createRequire(import.meta.url);

function getNodeCrypto(): NodeCryptoModule {
  return require('node:crypto') as NodeCryptoModule;
}

export function randomToken(size = 32): string {
  const { randomBytes } = getNodeCrypto();
  return randomBytes(size).toString('hex');
}

export function hashToken(token: string): string {
  const { createHash } = getNodeCrypto();
  return createHash('sha256').update(token).digest('hex');
}

export function hashPassword(password: string): string {
  const { randomBytes, scryptSync } = getNodeCrypto();
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const { scryptSync, timingSafeEqual } = getNodeCrypto();
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;

  const computedHash = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(hash, 'hex');

  if (computedHash.length !== storedBuffer.length) return false;
  return timingSafeEqual(computedHash, storedBuffer);
}
