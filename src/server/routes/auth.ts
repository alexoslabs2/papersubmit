import type { FastifyPluginAsync } from 'fastify';
import { sql } from 'kysely';
import { cookieName } from '../plugins/auth.js';
import { randomToken, sha256 } from '../security/crypto.js';
import { hashPassword, validatePasswordStrength, verifyPassword } from '../security/passwords.js';
import { stripHtml } from '../security/sanitize.js';
import { createSession, deleteOtherSessions, deleteSession } from '../auth/sessions.js';
import { audit } from '../services/audit.js';
import { enqueueEmail } from '../email/queue.js';

function setSessionCookie(reply: { setCookie: (name: string, value: string, options: Record<string, unknown>) => unknown }, rawToken: string, secure: boolean) {
  reply.setCookie(cookieName, rawToken, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure,
    signed: true,
    maxAge: 604_800
  });
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/register', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = request.body as { email?: string; password?: string; name?: string };
    const errors = validatePasswordStrength(body.password ?? '', 'speaker');
    if (errors.length > 0) return reply.badRequest(errors.join(' '));
    const user = await app.app.db
      .insertInto('users')
      .values({
        email: (body.email ?? '').toLowerCase(),
        name: stripHtml(body.name ?? ''),
        role: 'speaker',
        password_hash: await hashPassword(body.password!)
      })
      .returning(['id', 'email', 'name', 'role'])
      .executeTakeFirst();
    if (!user) return reply.badRequest('Registration failed');
    const session = await createSession(app.app.db, user.id);
    setSessionCookie(reply, session.rawToken, app.app.env.COOKIE_SECURE);
    await enqueueEmail(app.app.db, 'speaker_registered', user.email, { name: user.name, eventName: 'Paper Submit' }).catch(() => undefined);
    return { user };
  });

  app.post('/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const generic = 'Invalid email or password';
    const body = request.body as { email?: string; password?: string };
    const user = await app.app.db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', (body.email ?? '').toLowerCase())
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!user) return reply.unauthorized(generic);
    if (user.locked_until && user.locked_until > new Date()) return reply.unauthorized(generic);
    const ok = await verifyPassword(user.password_hash, body.password ?? '');
    if (!ok) {
      const failed = user.failed_login_attempts + 1;
      await app.app.db
        .updateTable('users')
        .set({
          failed_login_attempts: failed,
          locked_until: failed >= 3 ? new Date(Date.now() + 15 * 60 * 1000) : null
        })
        .where('id', '=', user.id)
        .execute();
      return reply.unauthorized(generic);
    }
    await app.app.db.updateTable('users').set({ failed_login_attempts: 0, locked_until: null }).where('id', '=', user.id).execute();
    const session = await createSession(app.app.db, user.id);
    setSessionCookie(reply, session.rawToken, app.app.env.COOKIE_SECURE);
    return { user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  });

  app.post('/auth/logout', { preHandler: app.authenticate }, async (request, reply) => {
    if (request.sessionId) await deleteSession(app.app.db, request.sessionId);
    reply.clearCookie(cookieName, { path: '/' });
    return { ok: true };
  });

  app.get('/me', { preHandler: app.authenticate }, async (request) => ({ user: request.user }));

  app.patch('/me', { preHandler: app.authenticate }, async (request) => {
    const body = request.body as { name?: string; password?: string };
    if (body.password) {
      const errors = validatePasswordStrength(body.password, request.user!.role);
      if (errors.length > 0) throw app.httpErrors.badRequest(errors.join(' '));
      await app.app.db.updateTable('users').set({ password_hash: await hashPassword(body.password) }).where('id', '=', request.user!.id).execute();
      await deleteOtherSessions(app.app.db, request.user!.id, request.sessionId);
    }
    if (body.name) {
      await app.app.db.updateTable('users').set({ name: stripHtml(body.name) }).where('id', '=', request.user!.id).execute();
    }
    return { ok: true };
  });

  app.post('/auth/forgot-password', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request) => {
    const body = request.body as { email?: string };
    const user = await app.app.db.selectFrom('users').select(['id', 'email']).where('email', '=', (body.email ?? '').toLowerCase()).executeTakeFirst();
    if (user) {
      const token = randomToken(32);
      await app.app.db
        .insertInto('password_reset_tokens')
        .values({ user_id: user.id, token_hash: sha256(token), expires_at: new Date(Date.now() + 60 * 60 * 1000) })
        .execute();
      await enqueueEmail(app.app.db, 'password_reset', user.email, { resetUrl: `${app.app.env.PUBLIC_BASE_URL}/reset-password?token=${token}` }).catch(() => undefined);
    }
    return { ok: true };
  });

  app.post('/auth/reset-password', async (request, reply) => {
    const body = request.body as { token?: string; password?: string };
    const tokenHash = sha256(body.token ?? '');
    const reset = await app.app.db
      .selectFrom('password_reset_tokens')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .where('used_at', 'is', null)
      .where('expires_at', '>', sql<Date>`now()`)
      .executeTakeFirst();
    if (!reset) return reply.badRequest('Invalid reset token');
    const user = await app.app.db.selectFrom('users').select(['role']).where('id', '=', reset.user_id).executeTakeFirstOrThrow();
    const errors = validatePasswordStrength(body.password ?? '', user.role);
    if (errors.length > 0) return reply.badRequest(errors.join(' '));
    await app.app.db.transaction().execute(async (trx) => {
      await trx.updateTable('users').set({ password_hash: await hashPassword(body.password!) }).where('id', '=', reset.user_id).execute();
      await trx.updateTable('password_reset_tokens').set({ used_at: new Date() }).where('id', '=', reset.id).execute();
      await trx.deleteFrom('sessions').where('user_id', '=', reset.user_id).execute();
      await audit(trx, reset.user_id, 'auth.password_reset', 'user', reset.user_id);
    });
    return { ok: true };
  });
};
