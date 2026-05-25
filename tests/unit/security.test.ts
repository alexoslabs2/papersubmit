import { describe, expect, it } from 'vitest';
import { sessionInactivityMs } from '../../src/server/auth/sessions.js';
import { decryptSecret, encryptSecret, sha256 } from '../../src/server/security/crypto.js';
import { validatePasswordStrength } from '../../src/server/security/passwords.js';

describe('security helpers', () => {
  it('hashes session tokens with sha256', () => {
    expect(sha256('token')).toHaveLength(64);
    expect(sha256('token')).not.toBe('token');
  });

  it('converts configured session inactivity minutes to milliseconds', () => {
    expect(sessionInactivityMs(30)).toBe(30 * 60 * 1000);
  });

  it('encrypts SMTP secrets with authenticated encryption', () => {
    const key = Buffer.alloc(32, 1).toString('base64');
    const encrypted = encryptSecret('smtp-secret', key);
    expect(encrypted).not.toContain('smtp-secret');
    expect(decryptSecret(encrypted, key)).toBe('smtp-secret');
  });

  it('enforces admin password length and common-password blocklist', () => {
    expect(validatePasswordStrength('short', 'admin')).toHaveLength(1);
    expect(validatePasswordStrength('password123', 'speaker')).toContain('Password is too common.');
  });
});
