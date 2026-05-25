import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import type { AppEnv } from '../../src/server/env.js';
import type { AppContext } from '../../src/server/types.js';
import { WorkerRegistry } from '../../src/server/workers/registry.js';

const env: AppEnv = {
  NODE_ENV: 'production',
  PORT: 3000,
  HOST: '127.0.0.1',
  PUBLIC_BASE_URL: 'https://cfp.example.com',
  DATABASE_URL: 'postgres://paper:paper@localhost:5432/paper',
  COOKIE_SECURE: true,
  TRUST_PROXY: false,
  SESSION_INACTIVITY_MINUTES: 480,
  APP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  STORAGE_PROVIDER: 'local',
  COOKIE_SECRET: 'a'.repeat(32),
  ADMIN_RECOVERY_EMAIL: ''
};

function context(): AppContext {
  return {
    db: {} as AppContext['db'],
    env,
    workers: new WorkerRegistry()
  };
}

describe('server app static fallback', () => {
  it('serves the built SPA shell for client-side routes', async () => {
    const originalCwd = process.cwd();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'paper-submit-static-'));

    process.chdir(tmp);
    await fs.mkdir(path.join(tmp, 'dist/web'), { recursive: true });
    await fs.writeFile(path.join(tmp, 'dist/web/index.html'), '<!doctype html><html><body>setup shell</body></html>');

    const app = await buildApp(context());
    try {
      const response = await app.inject({ method: 'GET', url: '/setup?token=test-token' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toContain('setup shell');
    } finally {
      await app.close();
      process.chdir(originalCwd);
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});

describe('server app CSRF protection', () => {
  it('issues an HttpOnly signed CSRF secret cookie and token response', async () => {
    const app = await buildApp(context());
    try {
      const response = await app.inject({ method: 'GET', url: '/csrf-token' });
      const body = response.json() as { csrfToken?: string };
      const setCookie = String(response.headers['set-cookie'] ?? '');

      expect(response.statusCode).toBe(200);
      expect(body.csrfToken).toBeTruthy();
      expect(setCookie).toContain('paper_csrf_secret=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Strict');
    } finally {
      await app.close();
    }
  });

  it('rejects unsafe requests without a valid CSRF token', async () => {
    const app = await buildApp(context());
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'admin@example.com', password: 'password' }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ message: 'Missing csrf secret', statusCode: 403 });
    } finally {
      await app.close();
    }
  });
});
