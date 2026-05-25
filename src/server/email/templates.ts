import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.js';
import type { EmailTriggerType } from '../../shared/types.js';
import { ensurePlainSubject, escapeHtml, sanitizeHtml } from '../security/sanitize.js';

export const defaultTemplates: Array<{
  name: string;
  trigger_type: EmailTriggerType;
  subject: string;
  html_body: string;
  text_body: string;
  required_variables: string[];
}> = [
  {
    name: 'Speaker registered',
    trigger_type: 'speaker_registered',
    subject: 'Welcome to {{eventName}}',
    html_body: '<p>Hello {{name}}, your speaker account is ready.</p>',
    text_body: 'Hello {{name}}, your speaker account is ready.',
    required_variables: ['eventName', 'name']
  },
  {
    name: 'Proposal submitted',
    trigger_type: 'proposal_submitted',
    subject: 'Proposal received: {{proposalTitle}}',
    html_body: '<p>Your proposal "{{proposalTitle}}" was received.</p>',
    text_body: 'Your proposal "{{proposalTitle}}" was received.',
    required_variables: ['proposalTitle']
  },
  {
    name: 'Reviewer invited',
    trigger_type: 'reviewer_invited',
    subject: 'Reviewer invitation for {{eventName}}',
    html_body: '<p>You have been invited to review. Accept here: <a href="{{inviteUrl}}">{{inviteUrl}}</a></p>',
    text_body: 'You have been invited to review. Accept here: {{inviteUrl}}',
    required_variables: ['eventName', 'inviteUrl']
  },
  {
    name: 'Password reset',
    trigger_type: 'password_reset',
    subject: 'Reset your Paper Submit password',
    html_body: '<p>Reset your password here: <a href="{{resetUrl}}">{{resetUrl}}</a></p>',
    text_body: 'Reset your password here: {{resetUrl}}',
    required_variables: ['resetUrl']
  },
  {
    name: 'Proposal accepted',
    trigger_type: 'proposal_accepted',
    subject: 'Proposal accepted: {{proposalTitle}}',
    html_body: '<p>Your proposal "{{proposalTitle}}" was accepted.</p>',
    text_body: 'Your proposal "{{proposalTitle}}" was accepted.',
    required_variables: ['proposalTitle']
  },
  {
    name: 'Proposal rejected',
    trigger_type: 'proposal_rejected',
    subject: 'Proposal decision: {{proposalTitle}}',
    html_body: '<p>Your proposal "{{proposalTitle}}" was not accepted.</p>',
    text_body: 'Your proposal "{{proposalTitle}}" was not accepted.',
    required_variables: ['proposalTitle']
  }
];

export async function seedDefaultTemplates(db: Kysely<Database>): Promise<void> {
  const count = await db.selectFrom('email_templates').select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirst();
  if (Number(count?.count ?? 0) > 0) return;
  await db.insertInto('email_templates').values(defaultTemplates.map((template) => ({
    ...template,
    subject: ensurePlainSubject(template.subject),
    html_body: sanitizeHtml(template.html_body)
  }))).execute();
}

export function renderTemplate(
  template: { subject: string; html_body: string; text_body: string; required_variables: string[] },
  variables: Record<string, unknown>
) {
  const missing = template.required_variables.filter((name) => variables[name] === undefined || variables[name] === null);
  if (missing.length > 0) {
    return { ok: false as const, missing };
  }
  const replace = (value: string, html: boolean) =>
    value.replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (_match, name: string) => {
      const replacement = variables[name] ?? '';
      return html ? escapeHtml(replacement) : String(replacement);
    });

  return {
    ok: true as const,
    subject: ensurePlainSubject(replace(template.subject, false)),
    htmlBody: sanitizeHtml(replace(template.html_body, true)),
    textBody: replace(template.text_body, false)
  };
}
