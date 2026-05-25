import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import csrfProtection from '@fastify/csrf-protection';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import staticPlugin from '@fastify/static';
import authPlugin from './plugins/auth.js';
import type { AppContext } from './types.js';
import { setupRoutes } from './routes/setup.js';
import { authRoutes } from './routes/auth.js';
import { eventRoutes } from './routes/event.js';
import { proposalRoutes } from './routes/proposals.js';
import { reviewRoutes } from './routes/reviews.js';
import { adminRoutes } from './routes/admin.js';
import { uploadRoutes } from './routes/uploads.js';
import { healthRoutes } from './routes/health.js';
import { eventLogoUploadDir } from './uploads/paths.js';

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const csrfCookie = 'paper_csrf_secret';

export async function buildApp(context: AppContext): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
    trustProxy: context.env.TRUST_PROXY,
    bodyLimit: 10 * 1024
  });

  app.decorate('app', context);
  await app.register(sensible);
  await app.register(cookie, { secret: context.env.COOKIE_SECRET });
  await app.register(csrfProtection, {
    cookieKey: csrfCookie,
    cookieOpts: {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      secure: context.env.COOKIE_SECURE,
      signed: true,
      maxAge: 604_800
    },
    getToken: (request) => {
      const token = request.headers['x-csrf-token'];
      return Array.isArray(token) ? token[0] : token;
    },
    logLevel: 'debug'
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives:
        context.env.NODE_ENV === 'production'
          ? {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"]
            }
          : {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-eval'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'", 'ws://localhost:*']
            }
    },
    hsts: context.env.NODE_ENV === 'production' ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: false
  });
  await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

  if (context.env.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        info: { title: 'Paper Submit API', version: '0.1.0' },
        openapi: '3.1.0'
      }
    });
    await app.register(swaggerUi, { routePrefix: '/docs' });
  }

  await app.register(authPlugin);

  app.addHook('preHandler', (request, reply, done) => {
    if (!unsafeMethods.has(request.method)) {
      done();
      return;
    }
    app.csrfProtection(request, reply, done);
  });

  app.get('/csrf-token', async (_request, reply) => {
    const token = reply.generateCsrf();
    reply.header('Cache-Control', 'no-store');
    return { csrfToken: token };
  });

  await app.register(healthRoutes);
  await app.register(setupRoutes);
  await app.register(authRoutes);
  await app.register(eventRoutes);
  await app.register(proposalRoutes);
  await app.register(reviewRoutes);
  await app.register(adminRoutes);
  await app.register(uploadRoutes);

  const uploadsRoot = eventLogoUploadDir();
  await fs.mkdir(uploadsRoot, { recursive: true });
  await app.register(staticPlugin, {
    root: uploadsRoot,
    prefix: '/uploads/event-logo/',
    decorateReply: false,
    list: false,
    setHeaders(res, pathname) {
      if (!/\/[0-9a-f-]{36}\.webp$/i.test(pathname)) {
        res.statusCode = 404;
      }
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  });

  const webRoot =
    context.env.NODE_ENV === 'production'
      ? path.resolve(process.cwd(), 'dist/web')
      : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');
  const hasBuiltWeb = await fs.access(path.join(webRoot, 'index.html')).then(() => true).catch(() => false);
  if (hasBuiltWeb) {
    await app.register(staticPlugin, {
      root: webRoot,
      prefix: '/',
      decorateReply: false
    });
  }

  app.setNotFoundHandler(async (request, reply) => {
    if (hasBuiltWeb && request.method === 'GET' && !request.url.startsWith('/api') && !request.url.startsWith('/uploads')) {
      const indexHtml = await fs.readFile(path.join(webRoot, 'index.html'), 'utf8');
      return reply.type('text/html; charset=utf-8').send(indexHtml);
    }
    return reply.notFound();
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const statusCode = typeof error === 'object' && error && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    const rawMessage = error instanceof Error ? error.message : 'Request failed';
    const message = statusCode === 403 && /csrf/i.test(rawMessage) ? 'Invalid CSRF token' : rawMessage;
    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : message,
      statusCode
    });
  });

  return app;
}
