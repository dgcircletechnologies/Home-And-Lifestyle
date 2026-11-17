import { scrypt, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';
export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
export async function verifyPassword(password: string, stored: string) {
  if (stored.startsWith('$argon2id$')) return argon2.verify(stored, password).catch(() => false);
  // Compatibility only: existing foundation hashes. Rehash after successful login.
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const actual = await new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, key) => e ? reject(e) : resolve(key)));
  const expected = Buffer.from(hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
