import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  PUBLIC_BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  TRUST_PROXY: z.coerce.boolean().default(false),
  SESSION_INACTIVITY_MINUTES: z.coerce.number().int().positive().default(480),
  APP_ENCRYPTION_KEY: z.string().min(16),
  STORAGE_PROVIDER: z.literal('local').default('local'),
  COOKIE_SECRET: z.string().min(32),
  ADMIN_RECOVERY_EMAIL: z.string().email().optional().or(z.literal(''))
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function loadEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;
  cachedEnv = envSchema.parse(process.env);
  return cachedEnv;
}

export function resetEnvForTests(): void {
  cachedEnv = null;
}
