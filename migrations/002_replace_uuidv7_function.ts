import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION uuidv7()
    RETURNS uuid AS $$
    WITH value AS (
      SELECT
        lpad(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint), 12, '0') AS ms_hex,
        encode(gen_random_bytes(10), 'hex') AS rand
    )
    SELECT (
      substr(ms_hex, 1, 8) || '-' ||
      substr(ms_hex, 9, 4) || '-' ||
      '7' || substr(rand, 1, 3) || '-' ||
      substr('89ab', ((get_byte(decode(substr(rand, 4, 2), 'hex'), 0) & 3) + 1), 1) || substr(rand, 6, 3) || '-' ||
      substr(rand, 9, 12)
    )::uuid
    FROM value;
    $$ LANGUAGE sql VOLATILE;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION uuidv7()
    RETURNS uuid AS $$
    SELECT gen_random_uuid();
    $$ LANGUAGE sql VOLATILE;
  `.execute(db);
}
