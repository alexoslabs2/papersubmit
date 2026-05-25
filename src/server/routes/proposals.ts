import type { FastifyPluginAsync } from 'fastify';
import { assertProposalTransition } from '../../shared/stateMachines.js';
import { enqueueEmail } from '../email/queue.js';
import { assertSubmissionsOpen } from '../services/events.js';
import { audit } from '../services/audit.js';
import { averageReviewScore, listAdminProposalReviews } from '../services/adminReviews.js';
import { sanitizeProposalPatch, validateAndSanitizeProposalPayload, type ProposalPayload } from '../services/proposalFields.js';

function mapProposal(row: {
  id: string;
  speaker_full_name: string;
  speaker_contact_email: string;
  company_organization: string;
  country: string;
  speaker_bio: string;
  online_presence: string;
  title: string;
  presentation_languages: string[];
  technical_level: string;
  abstract: string;
  description?: string;
  key_takeaways: string;
  related_tools: string;
  additional_notes: string;
  status: string;
  speaker_id: string;
  speaker_name: string;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: row.id,
    speakerFullName: row.speaker_full_name,
    speakerContactEmail: row.speaker_contact_email,
    companyOrganization: row.company_organization,
    country: row.country,
    speakerBio: row.speaker_bio,
    onlinePresence: row.online_presence,
    title: row.title,
    presentationLanguages: row.presentation_languages,
    technicalLevel: row.technical_level,
    abstract: row.abstract,
    description: row.description,
    keyTakeaways: row.key_takeaways,
    relatedTools: row.related_tools,
    additionalNotes: row.additional_notes,
    status: row.status,
    speakerId: row.speaker_id,
    speakerName: row.speaker_name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export const proposalRoutes: FastifyPluginAsync = async (app) => {
  app.get('/proposals', { preHandler: app.authenticate }, async (request) => {
    let query = app.app.db
      .selectFrom('proposals')
      .innerJoin('users', 'users.id', 'proposals.speaker_id')
      .select([
        'proposals.id',
        'proposals.speaker_full_name',
        'proposals.speaker_contact_email',
        'proposals.company_organization',
        'proposals.country',
        'proposals.speaker_bio',
        'proposals.online_presence',
        'proposals.title',
        'proposals.presentation_languages',
        'proposals.technical_level',
        'proposals.abstract',
        'proposals.description',
        'proposals.key_takeaways',
        'proposals.related_tools',
        'proposals.additional_notes',
        'proposals.status',
        'proposals.speaker_id',
        'proposals.created_at',
        'proposals.updated_at',
        'users.name as speaker_name'
      ])
      .where('proposals.deleted_at', 'is', null);
    if (request.user!.role === 'speaker') query = query.where('proposals.speaker_id', '=', request.user!.id);
    if (request.user!.role === 'reviewer') query = query.where('proposals.status', '=', 'under_review').where('proposals.speaker_id', '!=', request.user!.id);
    const rows = await query.orderBy('proposals.created_at', 'desc').execute();
    return { proposals: rows.map(mapProposal) };
  });

  app.post('/proposals', { preHandler: app.requireRole(['speaker']), config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
    try {
      await assertSubmissionsOpen(app.app.db);
    } catch {
      return reply.badRequest('CFP is not open');
    }
    const parsed = validateAndSanitizeProposalPayload(request.body as ProposalPayload);
    if (!parsed.ok) return reply.badRequest(parsed.error);
    const proposal = await app.app.db
      .insertInto('proposals')
      .values({
        speaker_id: request.user!.id,
        ...parsed.value,
        status: 'submitted'
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await audit(app.app.db, request.user!.id, 'proposal.submitted', 'proposal', proposal.id);
    await enqueueEmail(app.app.db, 'proposal_submitted', request.user!.email, { proposalTitle: proposal.title }).catch(() => undefined);
    return { proposal };
  });

  app.get('/proposals/:id', { preHandler: app.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    let query = app.app.db
      .selectFrom('proposals')
      .innerJoin('users', 'users.id', 'proposals.speaker_id')
      .select([
        'proposals.id',
        'proposals.speaker_full_name',
        'proposals.speaker_contact_email',
        'proposals.company_organization',
        'proposals.country',
        'proposals.speaker_bio',
        'proposals.online_presence',
        'proposals.title',
        'proposals.presentation_languages',
        'proposals.technical_level',
        'proposals.abstract',
        'proposals.description',
        'proposals.key_takeaways',
        'proposals.related_tools',
        'proposals.additional_notes',
        'proposals.status',
        'proposals.speaker_id',
        'proposals.created_at',
        'proposals.updated_at',
        'users.name as speaker_name'
      ])
      .where('proposals.id', '=', id)
      .where('proposals.deleted_at', 'is', null);
    if (request.user!.role === 'speaker') query = query.where('proposals.speaker_id', '=', request.user!.id);
    if (request.user!.role === 'reviewer') query = query.where('proposals.status', '=', 'under_review').where('proposals.speaker_id', '!=', request.user!.id);
    const proposal = await query.executeTakeFirst();
    if (!proposal) return reply.notFound('Proposal not found');
    const mapped = mapProposal(proposal);
    if (request.user!.role !== 'admin') return { proposal: mapped };

    const reviews = await listAdminProposalReviews(app.app.db, proposal.id);
    return {
      proposal: {
        ...mapped,
        reviews,
        reviewCount: reviews.length,
        averageScore: averageReviewScore(reviews)
      }
    };
  });

  app.patch('/proposals/:id', { preHandler: app.requireRole(['speaker']) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await assertSubmissionsOpen(app.app.db);
    } catch {
      return reply.badRequest('CFP is not open');
    }
    const current = await app.app.db
      .selectFrom('proposals')
      .selectAll()
      .where('id', '=', id)
      .where('speaker_id', '=', request.user!.id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!current) return reply.notFound('Proposal not found');
    if (current.status !== 'submitted') return reply.badRequest('Only submitted proposals may be edited');
    const patch = sanitizeProposalPatch(request.body as ProposalPayload);
    if (Object.keys(patch).length === 0) return reply.badRequest('No valid proposal fields provided');
    const proposal = await app.app.db
      .updateTable('proposals')
      .set(patch)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await audit(app.app.db, request.user!.id, 'proposal.updated', 'proposal', proposal.id);
    return { proposal };
  });

  app.post('/proposals/:id/withdraw', { preHandler: app.requireRole(['speaker']) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await assertSubmissionsOpen(app.app.db);
    } catch {
      return reply.badRequest('CFP is not open');
    }
    const current = await app.app.db
      .selectFrom('proposals')
      .selectAll()
      .where('id', '=', id)
      .where('speaker_id', '=', request.user!.id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!current) return reply.notFound('Proposal not found');
    assertProposalTransition(current.status, 'withdrawn');
    const proposal = await app.app.db.updateTable('proposals').set({ status: 'withdrawn' }).where('id', '=', id).returningAll().executeTakeFirstOrThrow();
    await audit(app.app.db, request.user!.id, 'proposal.withdrawn', 'proposal', proposal.id);
    return { proposal };
  });
};
