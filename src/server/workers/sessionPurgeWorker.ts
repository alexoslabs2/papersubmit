import { sql, type Kysely } from 'kysely';
import type { Database } from '../db/schema.js';
import type { WorkerRegistry } from './registry.js';

export function startSessionPurgeWorker(db: Kysely<Database>, registry: WorkerRegistry, inactivityMinutes: number): NodeJS.Timeout {
  const run = async () => {
    try {
      registry.sessionPurge.lastRunAt = new Date().toISOString();
      await sql`
        DELETE FROM sessions
        WHERE expires_at <= now()
          OR last_seen_at <= now() - (${inactivityMinutes} * interval '1 minute')
      `.execute(db);
    } catch (error) {
      console.error('session purge worker failed', error);
    }
  };

  void run();
  return setInterval(run, 60_000);
}
