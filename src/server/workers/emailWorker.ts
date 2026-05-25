import nodemailer from 'nodemailer';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import { decryptSecret } from '../security/crypto.js';
import { claimEmailJobs, markEmailFailed, markEmailSent } from '../email/queue.js';
import type { WorkerRegistry } from './registry.js';

export function startEmailWorker(db: Kysely<Database>, env: AppEnv, registry: WorkerRegistry): NodeJS.Timeout {
  const run = async () => {
    try {
      registry.email.lastRunAt = new Date().toISOString();
      const pending = await db
        .selectFrom('email_jobs')
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .where('status', 'in', ['queued', 'retrying'])
        .executeTakeFirst();
      registry.email.pendingJobs = Number(pending?.count ?? 0);

      const settings = await db.selectFrom('smtp_settings').selectAll().where('id', '=', 1).executeTakeFirst();
      if (!settings) return;

      const transporter = nodemailer.createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.port === 465,
        auth: settings.username
          ? {
              user: settings.username,
              pass: settings.encrypted_password ? decryptSecret(settings.encrypted_password, env.APP_ENCRYPTION_KEY) : ''
            }
          : undefined
      });

      const jobs = await claimEmailJobs(db);
      for (const job of jobs) {
        try {
          await transporter.sendMail({
            from: `${settings.from_name} <${settings.from_email}>`,
            to: job.recipient_email,
            subject: job.subject,
            html: job.html_body,
            text: job.text_body
          });
          await markEmailSent(db, job.id);
        } catch (error) {
          await markEmailFailed(db, job.id, job.attempts, error);
        }
      }
    } catch (error) {
      console.error('email worker failed', error);
    }
  };

  void run();
  return setInterval(run, 30_000);
}
