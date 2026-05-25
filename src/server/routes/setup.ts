import type { FastifyPluginAsync } from 'fastify';
import { sha256 } from '../security/crypto.js';
import { hashPassword, validatePasswordStrength } from '../security/passwords.js';
import { stripHtml } from '../security/sanitize.js';
import { audit } from '../services/audit.js';
import { normalizeSlug, validateTimezone } from '../services/events.js';
import { isSetupComplete } from '../setup/token.js';
import type { TalkFormat } from '../../shared/types.js';

const eventLongTextMaxLength = 1000;

export const setupRoutes: FastifyPluginAsync = async (app) => {
  app.get('/setup/status', async (_request, reply) => {
    if (await isSetupComplete(app.app.db)) return reply.notFound();
    return { complete: false };
  });

  app.post('/setup/validate-token', async (request, reply) => {
    if (await isSetupComplete(app.app.db)) return reply.notFound();
    const body = request.body as { token?: string };
    const setup = await app.app.db.selectFrom('setup_config').select('token_hash').where('id', '=', 1).executeTakeFirst();
    if (!body.token || !setup?.token_hash || sha256(body.token) !== setup.token_hash) {
      return reply.unauthorized('Invalid setup token');
    }
    return { ok: true };
  });

  app.post('/setup/complete', async (request, reply) => {
    if (await isSetupComplete(app.app.db)) return reply.notFound();
    const body = request.body as {
      token?: string;
      adminEmail?: string;
      adminPassword?: string;
      adminName?: string;
      eventName?: string;
      eventSlug?: string;
      location?: string;
      startDate?: string;
      endDate?: string;
      description?: string;
      codeOfConduct?: string;
      timezone?: string;
      cfpOpensAt?: string;
      cfpClosesAt?: string;
      cfpDescription?: string;
      talkFormats?: ('talk' | 'lightning' | 'workshop')[];
      scoringScale?: 'SCALE_1_5' | 'SCALE_1_10';
      minReviewsRequired?: number;
      travelAssistance?: string;
    };
    const setup = await app.app.db.selectFrom('setup_config').select('token_hash').where('id', '=', 1).executeTakeFirst();
    if (!body.token || !setup?.token_hash || sha256(body.token) !== setup.token_hash) {
      return reply.unauthorized('Invalid setup token');
    }
    const passwordErrors = validatePasswordStrength(body.adminPassword ?? '', 'admin');
    if (passwordErrors.length > 0) return reply.badRequest(passwordErrors.join(' '));
    if (!body.adminEmail || !body.eventName || !body.cfpOpensAt || !body.cfpClosesAt || !body.startDate || !body.endDate) {
      return reply.badRequest('Missing setup fields');
    }
    const slug = normalizeSlug(body.eventSlug || body.eventName);
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    const cfpOpensAt = new Date(body.cfpOpensAt);
    const cfpClosesAt = new Date(body.cfpClosesAt);
    const timezone = body.timezone || 'UTC';
    const talkFormats: TalkFormat[] = body.talkFormats?.length ? body.talkFormats : ['talk', 'lightning', 'workshop'];
    if (!slug) return reply.badRequest('Event slug is required');
    if ([startDate, endDate, cfpOpensAt, cfpClosesAt].some((date) => Number.isNaN(date.valueOf()))) return reply.badRequest('Event dates are invalid');
    if (startDate > endDate) return reply.badRequest('Start date must be before or equal to end date');
    if (cfpOpensAt >= cfpClosesAt) return reply.badRequest('CFP opens at must be before CFP closes at');
    if (!validateTimezone(timezone)) return reply.badRequest('Timezone must be a valid IANA timezone');
    let description: string | null;
    let cfpDescription: string | null;
    let codeOfConduct: string | null;
    try {
      description = cleanSetupText(body.description, 'Description');
      cfpDescription = cleanSetupText(body.cfpDescription, 'CFP description');
      codeOfConduct = cleanSetupText(body.codeOfConduct, 'Code of conduct');
    } catch (error) {
      return reply.badRequest(error instanceof Error ? error.message : 'Event text fields are invalid');
    }

    await app.app.db.transaction().execute(async (trx) => {
      const admin = await trx
        .insertInto('users')
        .values({
          email: body.adminEmail!.toLowerCase(),
          name: stripHtml(body.adminName || 'Admin'),
          role: 'admin',
          password_hash: await hashPassword(body.adminPassword!)
        })
        .returning(['id'])
        .executeTakeFirstOrThrow();
      const event = await trx
        .insertInto('event')
        .values({
          id: 1,
          name: stripHtml(body.eventName!),
          slug,
          location: body.location ? stripHtml(body.location) : null,
          start_date: startDate,
          end_date: endDate,
          timezone,
          description,
          code_of_conduct: codeOfConduct,
          status: 'draft',
          cfp_opens_at: cfpOpensAt,
          cfp_closes_at: cfpClosesAt,
          cfp_description: cfpDescription,
          talk_formats: talkFormats,
          scoring_scale: body.scoringScale ?? 'SCALE_1_5',
          min_reviews_required: body.minReviewsRequired ?? 1,
          travel_assistance: body.travelAssistance ? stripHtml(body.travelAssistance) : null
        })
        .returning(['id'])
        .executeTakeFirstOrThrow();
      await trx.updateTable('setup_config').set({ completed_at: new Date(), token_hash: null }).where('id', '=', 1).execute();
      await audit(trx, admin.id, 'setup.completed', 'event', String(event.id));
    });

    return {
      ok: true,
      postSetup: [
        'Login and open Event & CFP to upload the CFP landing page image.',
        'Configure SMTP in the Admin Dashboard.',
        'Set CFP status from Draft to Open.',
        'Invite reviewers.'
      ]
    };
  });
};

function cleanSetupText(value: string | undefined, label: string): string | null {
  if (!value) return null;
  const cleaned = stripHtml(value).trim();
  if (cleaned.length > eventLongTextMaxLength) throw new Error(`${label} must be ${eventLongTextMaxLength} characters or fewer`);
  return cleaned.length === 0 ? null : cleaned;
}
