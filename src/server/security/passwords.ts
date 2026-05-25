import { hash, verify } from '@node-rs/argon2';

const commonPasswords = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  'qwerty123',
  'letmein123',
  'admin123456',
  'paper1234'
]);

export function validatePasswordStrength(password: string, role: 'admin' | 'reviewer' | 'speaker'): string[] {
  const errors: string[] = [];
  const min = role === 'admin' ? 12 : 8;
  if (password.length < min) errors.push(`Password must be at least ${min} characters.`);
  if (commonPasswords.has(password.toLowerCase())) errors.push('Password is too common.');
  return errors;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    algorithm: 2
  });
}

export async function verifyPassword(hashValue: string, password: string): Promise<boolean> {
  return verify(hashValue, password);
}
