import type { FastifyPluginAsync } from 'fastify';
import { sql } from 'kysely';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          required: ['status', 'db', 'worker'],
          properties: {
            status: { enum: ['ok', 'degraded'] },
            db: { enum: ['ok', 'error'] },
            worker: { type: 'object' }
          }
        }
      }
    }
  }, async () => {
    try {
      await sql`select 1`.execute(app.app.db);
      return app.app.workers.health('ok');
    } catch {
      return app.app.workers.health('error');
    }
  });
};
