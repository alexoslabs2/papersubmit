import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import { randomToken, sha256 } from '../security/crypto.js';

export async function ensureSetupToken(db: Kysely<Database>, env: AppEnv): Promise<string | null> {
  const setup = await db.selectFrom('setup_config').selectAll().where('id', '=', 1).executeTakeFirst();
  if (setup?.completed_at) return null;
  const token = randomToken(32);
  await db
    .insertInto('setup_config')
    .values({ id: 1, token_hash: sha256(token) })
    .onConflict((oc) => oc.column('id').doUpdateSet({ token_hash: sha256(token) }))
    .execute();
  console.info(`Setup URL: ${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/setup?token=${token}`);
  return token;
}

export async function isSetupComplete(db: Kysely<Database>): Promise<boolean> {
  const setup = await db.selectFrom('setup_config').select('completed_at').where('id', '=', 1).executeTakeFirst();
  return Boolean(setup?.completed_at);
}
