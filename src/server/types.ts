import type { Kysely } from 'kysely';
import type { AppEnv } from './env.js';
import type { Database, User } from './db/schema.js';
import type { WorkerRegistry } from './workers/registry.js';

export interface AppContext {
  db: Kysely<Database>;
  env: AppEnv;
  workers: WorkerRegistry;
}

export type AuthenticatedUser = Pick<User, 'id' | 'email' | 'name' | 'role'>;

declare module 'fastify' {
  interface FastifyInstance {
    app: AppContext;
    authenticate: (request: import('fastify').FastifyRequest) => Promise<void>;
    requireRole: (roles: AuthenticatedUser['role'][]) => (request: import('fastify').FastifyRequest) => Promise<void>;
  }

  interface FastifyRequest {
    user?: AuthenticatedUser;
    sessionId?: string;
  }
}
