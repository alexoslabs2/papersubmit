import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE proposals
      DROP CONSTRAINT IF EXISTS proposals_key_takeaways_length,
      ADD CONSTRAINT proposals_key_takeaways_length CHECK (char_length(key_takeaways) <= 500);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE proposals
      DROP CONSTRAINT IF EXISTS proposals_key_takeaways_length,
      ADD CONSTRAINT proposals_key_takeaways_length CHECK (char_length(key_takeaways) <= 100);
  `.execute(db);
}
