import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.js';

export async function audit(
  db: Kysely<Database>,
  actorUserId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await db
    .insertInto('audit_logs')
    .values({
      actor_user_id: actorUserId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata
    })
    .execute();
}
