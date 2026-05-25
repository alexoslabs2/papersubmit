import fp from 'fastify-plugin';
import type { FastifyRequest } from 'fastify';
import { resolveSession, sessionInactivityMs } from '../auth/sessions.js';
import type { AuthenticatedUser } from '../types.js';

const cookieName = 'paper_session';

export { cookieName };

export default fp(async (fastify) => {
  fastify.decorate('authenticate', async (request: FastifyRequest) => {
    const signed = request.unsignCookie(request.cookies[cookieName] ?? '');
    if (!signed.valid || !signed.value) throw fastify.httpErrors.unauthorized('Authentication required');
    const session = await resolveSession(fastify.app.db, signed.value, sessionInactivityMs(fastify.app.env.SESSION_INACTIVITY_MINUTES));
    if (!session) throw fastify.httpErrors.unauthorized('Authentication required');
    request.user = session.user;
    request.sessionId = session.sessionId;
  });

  fastify.decorate('requireRole', (roles: AuthenticatedUser['role'][]) => {
    return async (request: FastifyRequest) => {
      await fastify.authenticate(request);
      if (!request.user || !roles.includes(request.user.role)) {
        throw fastify.httpErrors.forbidden('Forbidden');
      }
    };
  });
});
