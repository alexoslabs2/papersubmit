import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION reject_audit_log_mutation()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'audit_logs are immutable';
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('uuidv7')))
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('role', 'text', (col) => col.notNull())
    .addColumn('password_hash', 'text', (col) => col.notNull())
    .addColumn('failed_login_attempts', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('locked_until', 'timestamptz')
    .addColumn('deleted_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .execute();

  await db.schema
    .createTable('sessions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('uuidv7')))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('token_hash', 'text', (col) => col.notNull().unique())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('last_seen_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('setup_config')
    .addColumn('id', 'integer', (col) => col.primaryKey().defaultTo(1))
    .addColumn('token_hash', 'text')
    .addColumn('completed_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .execute();

  await db.schema
    .createTable('events')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('uuidv7')))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('slug', 'text', (col) => col.notNull().unique())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('timezone', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('draft'))
    .addColumn('cfp_opens_at', 'timestamptz', (col) => col.notNull())
    .addColumn('cfp_closes_at', 'timestamptz', (col) => col.notNull())
    .addColumn('logo_path', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .execute();

  await db.schema
    .createTable('proposals')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('uuidv7')))
    .addColumn('speaker_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('restrict'))
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('abstract', 'text', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('submitted'))
    .addColumn('decided_at', 'timestamptz')
    .addColumn('deleted_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .execute();

  await db.schema
    .createTable('reviews')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('uuidv7')))
    .addColumn('proposal_id', 'uuid', (col) => col.notNull().references('proposals.id').onDelete('cascade'))
    .addColumn('reviewer_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('score', 'integer', (col) => col.notNull())
    .addColumn('comments', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .addUniqueConstraint('reviews_proposal_reviewer_unique', ['proposal_id', 'reviewer_id'])
    .execute();

  await db.schema
    .createTable('reviewer_invitations')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('uuidv7')))
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('token_hash', 'text', (col) => col.notNull().unique())
    .addColumn('accepted_at', 'timestamptz')
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .execute();

  await db.schema
    .createTable('password_reset_tokens')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('uuidv7')))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('token_hash', 'text', (col) => col.notNull().unique())
    .addColumn('used_at', 'timestamptz')
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .execute();

  await db.schema
    .createTable('smtp_settings')
    .addColumn('id', 'integer', (col) => col.primaryKey().defaultTo(1))
    .addColumn('host', 'text', (col) => col.notNull())
    .addColumn('port', 'integer', (col) => col.notNull())
    .addColumn('username', 'text')
    .addColumn('encrypted_password', 'text')
    .addColumn('from_email', 'text', (col) => col.notNull())
    .addColumn('from_name', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .execute();

  await db.schema
    .createTable('email_templates')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('uuidv7')))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('trigger_type', 'text', (col) => col.notNull().unique())
    .addColumn('subject', 'text', (col) => col.notNull())
    .addColumn('html_body', 'text', (col) => col.notNull())
    .addColumn('text_body', 'text', (col) => col.notNull())
    .addColumn('required_variables', sql`text[]`, (col) => col.notNull().defaultTo(sql`'{}'::text[]`))
    .addColumn('is_system', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .execute();

  await db.schema
    .createTable('email_jobs')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('uuidv7')))
    .addColumn('template_id', 'uuid', (col) => col.references('email_templates.id').onDelete('set null'))
    .addColumn('trigger_type', 'text', (col) => col.notNull())
    .addColumn('recipient_email', 'text', (col) => col.notNull())
    .addColumn('subject', 'text', (col) => col.notNull())
    .addColumn('html_body', 'text', (col) => col.notNull())
    .addColumn('text_body', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('queued'))
    .addColumn('attempts', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('available_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('processing_started_at', 'timestamptz')
    .addColumn('sent_at', 'timestamptz')
    .addColumn('error_message', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .execute();

  await db.schema
    .createTable('audit_logs')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('actor_user_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('action', 'text', (col) => col.notNull())
    .addColumn('entity_type', 'text', (col) => col.notNull())
    .addColumn('entity_id', 'uuid')
    .addColumn('metadata', 'jsonb', (col) => col.notNull().defaultTo('{}'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .execute();

  for (const table of ['users', 'setup_config', 'events', 'proposals', 'reviews', 'smtp_settings', 'email_templates', 'email_jobs']) {
    await sql.raw(`
      CREATE TRIGGER ${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `).execute(db);
  }

  await sql`
    CREATE TRIGGER audit_logs_reject_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();
    CREATE TRIGGER audit_logs_reject_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();
    INSERT INTO setup_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('audit_logs').ifExists().execute();
  await db.schema.dropTable('email_jobs').ifExists().execute();
  await db.schema.dropTable('email_templates').ifExists().execute();
  await db.schema.dropTable('smtp_settings').ifExists().execute();
  await db.schema.dropTable('password_reset_tokens').ifExists().execute();
  await db.schema.dropTable('reviewer_invitations').ifExists().execute();
  await db.schema.dropTable('reviews').ifExists().execute();
  await db.schema.dropTable('proposals').ifExists().execute();
  await db.schema.dropTable('events').ifExists().execute();
  await db.schema.dropTable('setup_config').ifExists().execute();
  await db.schema.dropTable('sessions').ifExists().execute();
  await db.schema.dropTable('users').ifExists().execute();
}
