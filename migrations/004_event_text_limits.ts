import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_description_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_code_of_conduct_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_cfp_description_length;

    ALTER TABLE event ADD CONSTRAINT event_description_length CHECK (description IS NULL OR char_length(description) <= 1000);
    ALTER TABLE event ADD CONSTRAINT event_code_of_conduct_length CHECK (code_of_conduct IS NULL OR char_length(code_of_conduct) <= 1000);
    ALTER TABLE event ADD CONSTRAINT event_cfp_description_length CHECK (cfp_description IS NULL OR char_length(cfp_description) <= 1000);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_description_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_code_of_conduct_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_cfp_description_length;

    ALTER TABLE event ADD CONSTRAINT event_description_length CHECK (description IS NULL OR char_length(description) <= 500);
    ALTER TABLE event ADD CONSTRAINT event_code_of_conduct_length CHECK (code_of_conduct IS NULL OR char_length(code_of_conduct) <= 1000);
    ALTER TABLE event ADD CONSTRAINT event_cfp_description_length CHECK (cfp_description IS NULL OR char_length(cfp_description) <= 500);
  `.execute(db);
}
