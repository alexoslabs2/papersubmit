import { sql, type Kysely } from 'kysely';
import type { Database } from '../db/schema.js';
import type { EmailTriggerType } from '../../shared/types.js';
import { renderTemplate } from './templates.js';

export async function enqueueEmail(
  db: Kysely<Database>,
  triggerType: EmailTriggerType,
  recipientEmail: string,
  variables: Record<string, unknown>
): Promise<void> {
  const template = await db.selectFrom('email_templates').selectAll().where('trigger_type', '=', triggerType).executeTakeFirst();
  if (!template) return;
  const rendered = renderTemplate(template, variables);
  if (!rendered.ok) throw new Error(`Missing email template variables: ${rendered.missing.join(', ')}`);
  await db
    .insertInto('email_jobs')
    .values({
      template_id: template.id,
      trigger_type: triggerType,
      recipient_email: recipientEmail,
      subject: rendered.subject,
      html_body: rendered.htmlBody,
      text_body: rendered.textBody,
      status: 'queued'
    })
    .execute();
}

export async function claimEmailJobs(db: Kysely<Database>, limit = 10) {
  return sql<{
    id: string;
    recipient_email: string;
    subject: string;
    html_body: string;
    text_body: string;
    attempts: number;
  }>`
    WITH stale AS (
      UPDATE email_jobs
      SET status = 'retrying',
          processing_started_at = NULL,
          available_at = now(),
          updated_at = now()
      WHERE status = 'processing'
        AND processing_started_at < now() - interval '5 minutes'
      RETURNING id
    ),
    claimed AS (
      SELECT id
      FROM email_jobs
      WHERE status IN ('queued', 'retrying')
        AND available_at <= now()
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE email_jobs
    SET status = 'processing',
        processing_started_at = now(),
        updated_at = now()
    WHERE id IN (SELECT id FROM claimed)
    RETURNING id, recipient_email, subject, html_body, text_body, attempts
  `.execute(db).then((result) => result.rows);
}

export async function markEmailSent(db: Kysely<Database>, id: string): Promise<void> {
  await db
    .updateTable('email_jobs')
    .set({ status: 'sent', sent_at: new Date(), processing_started_at: null, error_message: null })
    .where('id', '=', id)
    .execute();
}

export async function markEmailFailed(db: Kysely<Database>, id: string, attempts: number, error: unknown): Promise<void> {
  const nextAttempts = attempts + 1;
  const finalFailure = nextAttempts >= 3;
  const delays = [5, 30, 120];
  const availableAt = new Date(Date.now() + delays[Math.min(nextAttempts - 1, 2)] * 60 * 1000);
  await db
    .updateTable('email_jobs')
    .set({
      status: finalFailure ? 'failed' : 'retrying',
      attempts: nextAttempts,
      available_at: availableAt,
      processing_started_at: null,
      error_message: error instanceof Error ? error.message : String(error)
    })
    .where('id', '=', id)
    .execute();
}
