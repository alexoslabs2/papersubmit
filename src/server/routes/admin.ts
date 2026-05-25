import type { FastifyPluginAsync } from 'fastify';
import nodemailer from 'nodemailer';
import { sql } from 'kysely';
import { assertProposalTransition } from '../../shared/stateMachines.js';
import { randomToken, sha256, encryptSecret, decryptSecret } from '../security/crypto.js';
import { hashPassword, validatePasswordStrength } from '../security/passwords.js';
import { ensurePlainSubject, sanitizeHtml, stripHtml } from '../security/sanitize.js';
import { audit } from '../services/audit.js';
import { enqueueEmail } from '../email/queue.js';
import { renderTemplate } from '../email/templates.js';
import { assertDecisionsOpen } from '../services/events.js';

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/admin/dashboard', { preHandler: app.requireRole(['admin']) }, async () => {
    const proposalCounts = await app.app.db
      .selectFrom('proposals')
      .select(['status'])
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('deleted_at', 'is', null)
      .groupBy('status')
      .execute();
    const reviewers = await app.app.db.selectFrom('users').select((eb) => eb.fn.countAll<number>().as('count')).where('role', '=', 'reviewer').where('deleted_at', 'is', null).executeTakeFirst();
    return { proposalCounts, reviewerCount: Number(reviewers?.count ?? 0) };
  });

  app.get('/admin/submissions', { preHandler: app.requireRole(['admin']) }, async (request) => {
    const query = request.query as { cursor?: string; limit?: string };
    const limit = Math.min(Number(query.limit ?? 25), 100);
    let builder = app.app.db
      .selectFrom('proposals')
      .innerJoin('users', 'users.id', 'proposals.speaker_id')
      .select([
        'proposals.id',
        'proposals.speaker_full_name',
        'proposals.speaker_contact_email',
        'proposals.company_organization',
        'proposals.country',
        'proposals.title',
        'proposals.abstract',
        'proposals.status',
        'proposals.created_at',
        'users.name as speaker_name',
        'users.email as speaker_email'
      ])
      .where('proposals.deleted_at', 'is', null);
    if (query.cursor) builder = builder.where('proposals.created_at', '<', new Date(query.cursor));
    const rows = await builder.orderBy('proposals.created_at', 'desc').limit(limit + 1).execute();
    const nextCursor = rows.length > limit ? rows[limit - 1].created_at.toISOString() : null;
    return { submissions: rows.slice(0, limit), nextCursor };
  });

  app.post('/admin/proposals/:id/decide', { preHandler: app.requireRole(['admin']) }, async (request, reply) => {
    try {
      await assertDecisionsOpen(app.app.db);
    } catch {
      return reply.badRequest('Event is not reviewing');
    }
    const { id } = request.params as { id: string };
    const body = request.body as { decision?: 'accepted' | 'rejected' };
    if (body.decision !== 'accepted' && body.decision !== 'rejected') return reply.badRequest('Invalid decision');
    const proposal = await app.app.db
      .selectFrom('proposals')
      .innerJoin('users', 'users.id', 'proposals.speaker_id')
      .select(['proposals.id', 'proposals.title', 'proposals.status', 'users.email as speaker_email'])
      .where('proposals.id', '=', id)
      .where('proposals.deleted_at', 'is', null)
      .executeTakeFirst();
    if (!proposal) return reply.notFound('Proposal not found');
    assertProposalTransition(proposal.status, body.decision);
    await app.app.db
      .updateTable('proposals')
      .set({ status: body.decision, decided_at: new Date() })
      .where('id', '=', id)
      .execute();
    await audit(app.app.db, request.user!.id, `proposal.${body.decision}`, 'proposal', id);
    await enqueueEmail(app.app.db, body.decision === 'accepted' ? 'proposal_accepted' : 'proposal_rejected', proposal.speaker_email, {
      proposalTitle: proposal.title
    }).catch(() => undefined);
    return { ok: true };
  });

  app.get('/admin/reviewers', { preHandler: app.requireRole(['admin']) }, async () => {
    const reviewers = await app.app.db.selectFrom('users').select(['id', 'email', 'name', 'created_at']).where('role', '=', 'reviewer').where('deleted_at', 'is', null).execute();
    const invitations = await app.app.db.selectFrom('reviewer_invitations').selectAll().where('accepted_at', 'is', null).execute();
    return { reviewers, invitations };
  });

  app.post('/admin/reviewers/invite', { preHandler: app.requireRole(['admin']) }, async (request) => {
    const body = request.body as { email?: string };
    const token = randomToken(32);
    await app.app.db.insertInto('reviewer_invitations').values({
      email: (body.email ?? '').toLowerCase(),
      token_hash: sha256(token),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }).execute();
    await enqueueEmail(app.app.db, 'reviewer_invited', (body.email ?? '').toLowerCase(), {
      eventName: 'Paper Submit',
      inviteUrl: `${app.app.env.PUBLIC_BASE_URL}/register?invite=${token}`
    }).catch(() => undefined);
    return { ok: true };
  });

  app.post('/auth/reviewer-invitations/accept', async (request, reply) => {
    const body = request.body as { token?: string; name?: string; password?: string };
    const invitation = await app.app.db
      .selectFrom('reviewer_invitations')
      .selectAll()
      .where('token_hash', '=', sha256(body.token ?? ''))
      .where('accepted_at', 'is', null)
      .where('expires_at', '>', sql<Date>`now()`)
      .executeTakeFirst();
    if (!invitation) return reply.badRequest('Invalid invitation');
    const errors = validatePasswordStrength(body.password ?? '', 'reviewer');
    if (errors.length > 0) return reply.badRequest(errors.join(' '));
    await app.app.db.transaction().execute(async (trx) => {
      const reviewer = await trx.insertInto('users').values({
        email: invitation.email,
        name: stripHtml(body.name ?? ''),
        role: 'reviewer',
        password_hash: await hashPassword(body.password!)
      }).returning(['id']).executeTakeFirstOrThrow();
      await trx.updateTable('reviewer_invitations').set({ accepted_at: new Date() }).where('id', '=', invitation.id).execute();
      await audit(trx, reviewer.id, 'reviewer.accepted_invitation', 'user', reviewer.id);
    });
    return { ok: true };
  });

  app.delete('/admin/reviewers/:id', { preHandler: app.requireRole(['admin']) }, async (request) => {
    const { id } = request.params as { id: string };
    await app.app.db.updateTable('users').set({ deleted_at: new Date() }).where('id', '=', id).where('role', '=', 'reviewer').execute();
    await audit(app.app.db, request.user!.id, 'reviewer.deleted', 'user', id);
    return { ok: true };
  });

  app.get('/admin/email-templates', { preHandler: app.requireRole(['admin']) }, async () => ({
    templates: await app.app.db.selectFrom('email_templates').selectAll().orderBy('name').execute()
  }));

  app.patch('/admin/email-templates/:id', { preHandler: app.requireRole(['admin']) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { subject?: string; htmlBody?: string; textBody?: string };
    const template = await app.app.db.selectFrom('email_templates').selectAll().where('id', '=', id).executeTakeFirst();
    if (!template) return reply.notFound('Template not found');
    const updated = await app.app.db.updateTable('email_templates').set({
      subject: body.subject ? ensurePlainSubject(body.subject) : template.subject,
      html_body: body.htmlBody ? sanitizeHtml(body.htmlBody) : template.html_body,
      text_body: body.textBody ?? template.text_body
    }).where('id', '=', id).returningAll().executeTakeFirstOrThrow();
    await audit(app.app.db, request.user!.id, 'email_template.updated', 'email_template', id);
    return { template: updated };
  });

  app.post('/admin/email-templates/:id/preview', { preHandler: app.requireRole(['admin']) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { variables?: Record<string, unknown> };
    const template = await app.app.db.selectFrom('email_templates').selectAll().where('id', '=', id).executeTakeFirst();
    if (!template) return reply.notFound('Template not found');
    const rendered = renderTemplate(template, body.variables ?? {});
    if (!rendered.ok) return reply.badRequest(`Missing variables: ${rendered.missing.join(', ')}`);
    return rendered;
  });

  app.get('/admin/smtp', { preHandler: app.requireRole(['admin']) }, async () => {
    const settings = await app.app.db.selectFrom('smtp_settings').select(['host', 'port', 'username', 'from_email', 'from_name']).where('id', '=', 1).executeTakeFirst();
    return { smtp: settings };
  });

  app.put('/admin/smtp', { preHandler: app.requireRole(['admin']) }, async (request) => {
    const body = request.body as { host: string; port: number; username?: string; password?: string; fromEmail: string; fromName: string };
    const encryptedPassword = body.password ? encryptSecret(body.password, app.app.env.APP_ENCRYPTION_KEY) : null;
    await app.app.db.insertInto('smtp_settings').values({
      id: 1,
      host: body.host,
      port: body.port,
      username: body.username || null,
      encrypted_password: encryptedPassword,
      from_email: body.fromEmail,
      from_name: body.fromName
    }).onConflict((oc) => oc.column('id').doUpdateSet((eb) => ({
      host: eb.ref('excluded.host'),
      port: eb.ref('excluded.port'),
      username: eb.ref('excluded.username'),
      encrypted_password: body.password ? eb.ref('excluded.encrypted_password') : eb.ref('smtp_settings.encrypted_password'),
      from_email: eb.ref('excluded.from_email'),
      from_name: eb.ref('excluded.from_name')
    }))).execute();
    await audit(app.app.db, request.user!.id, 'smtp.updated', 'smtp', null);
    return { ok: true };
  });

  app.post('/admin/smtp/test', { preHandler: app.requireRole(['admin']) }, async (request) => {
    const settings = await app.app.db.selectFrom('smtp_settings').selectAll().where('id', '=', 1).executeTakeFirstOrThrow();
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.port === 465,
      auth: settings.username ? { user: settings.username, pass: settings.encrypted_password ? decryptSecret(settings.encrypted_password, app.app.env.APP_ENCRYPTION_KEY) : '' } : undefined
    });
    await transporter.verify();
    await audit(app.app.db, request.user!.id, 'smtp.tested', 'smtp', null);
    return { ok: true };
  });

  app.get('/admin/audit-logs', { preHandler: app.requireRole(['admin']) }, async () => ({
    auditLogs: await app.app.db.selectFrom('audit_logs').selectAll().orderBy('id', 'desc').limit(100).execute()
  }));
};
