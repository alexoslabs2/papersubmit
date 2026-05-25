import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.js';
import { transitionExpiredOpenEvent } from '../services/events.js';

export function startEventWorker(db: Kysely<Database>): NodeJS.Timeout {
  const run = async () => {
    try {
      await transitionExpiredOpenEvent(db);
    } catch (error) {
      console.error('event worker failed', error);
    }
  };

  void run();
  return setInterval(run, 30_000);
}
