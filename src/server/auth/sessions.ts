import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.js';
import { randomToken, sha256 } from '../security/crypto.js';

const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

export interface CreatedSession {
  rawToken: string;
  expiresAt: Date;
}

export function sessionInactivityMs(minutes: number): number {
  return minutes * 60 * 1000;
}

export async function createSession(db: Kysely<Database>, userId: string, now = new Date()): Promise<CreatedSession> {
  const rawToken = randomToken(32);
  const expiresAt = new Date(now.getTime() + sevenDaysMs);
  await db
    .insertInto('sessions')
    .values({
      user_id: userId,
      token_hash: sha256(rawToken),
      expires_at: expiresAt
    })
    .execute();
  return { rawToken, expiresAt };
}

export async function resolveSession(db: Kysely<Database>, rawToken: string, inactivityMs: number, now = new Date()) {
  const tokenHash = sha256(rawToken);
  const row = await db
    .selectFrom('sessions')
    .innerJoin('users', 'users.id', 'sessions.user_id')
    .select([
      'sessions.id as session_id',
      'sessions.created_at',
      'sessions.last_seen_at',
      'sessions.expires_at',
      'users.id',
      'users.email',
      'users.name',
      'users.role'
    ])
    .where('sessions.token_hash', '=', tokenHash)
    .where('users.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) return null;
  if (row.expires_at <= now || row.last_seen_at <= new Date(now.getTime() - inactivityMs)) {
    await db.deleteFrom('sessions').where('id', '=', row.session_id).execute();
    return null;
  }

  await db.updateTable('sessions').set({ last_seen_at: now }).where('id', '=', row.session_id).execute();
  return {
    sessionId: row.session_id,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role
    }
  };
}

export async function deleteSession(db: Kysely<Database>, sessionId: string): Promise<void> {
  await db.deleteFrom('sessions').where('id', '=', sessionId).execute();
}

export async function deleteOtherSessions(db: Kysely<Database>, userId: string, keepSessionId?: string): Promise<void> {
  let query = db.deleteFrom('sessions').where('user_id', '=', userId);
  if (keepSessionId) query = query.where('id', '!=', keepSessionId);
  await query.execute();
}
