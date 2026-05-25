import type { FastifyPluginAsync } from 'fastify';
import { assertReviewsOpen } from '../services/events.js';
import { stripHtml } from '../security/sanitize.js';
import { audit } from '../services/audit.js';
import { listReviewerQueue } from '../services/reviewQueue.js';
import { listAdminProposalReviews } from '../services/adminReviews.js';

export const reviewRoutes: FastifyPluginAsync = async (app) => {
  app.get('/reviews', { preHandler: app.requireRole(['admin', 'reviewer']) }, async (request) => {
    if (request.user!.role === 'admin') {
      const { proposalId } = request.query as { proposalId?: string };
      if (proposalId) return { reviews: await listAdminProposalReviews(app.app.db, proposalId) };

      const reviews = await app.app.db
        .selectFrom('reviews')
        .innerJoin('users', 'users.id', 'reviews.reviewer_id')
        .innerJoin('proposals', 'proposals.id', 'reviews.proposal_id')
        .select([
          'reviews.id',
          'reviews.proposal_id',
          'reviews.reviewer_id',
          'reviews.score',
          'reviews.comments',
          'reviews.created_at',
          'reviews.updated_at',
          'users.name as reviewer_name',
          'users.email as reviewer_email',
          'proposals.title as proposal_title'
        ])
        .where('proposals.deleted_at', 'is', null)
        .orderBy('reviews.created_at', 'desc')
        .execute();

      return {
        reviews: reviews.map((review) => ({
          id: review.id,
          proposalId: review.proposal_id,
          proposalTitle: review.proposal_title,
          reviewerId: review.reviewer_id,
          reviewerName: review.reviewer_name,
          reviewerEmail: review.reviewer_email,
          score: review.score,
          comments: review.comments,
          createdAt: review.created_at.toISOString(),
          updatedAt: review.updated_at.toISOString()
        }))
      };
    }

    const proposals = await listReviewerQueue(app.app.db, request.user!.id);
    return { reviews: proposals };
  });

  app.post('/reviews', { preHandler: app.requireRole(['admin', 'reviewer']) }, async (request, reply) => {
    try {
      await assertReviewsOpen(app.app.db);
    } catch {
      return reply.badRequest('Reviews are not open');
    }
    const body = request.body as { proposalId?: string; score?: number; comments?: string };
    if (!Number.isInteger(body.score) || body.score! < 1 || body.score! > 10) return reply.badRequest('Score must be between 1 and 10');
    const score = body.score!;
    const proposal = await app.app.db
      .selectFrom('proposals')
      .selectAll()
      .where('id', '=', body.proposalId ?? '')
      .where('status', '=', 'under_review')
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!proposal) return reply.notFound('Proposal not found');
    if (request.user!.role === 'reviewer' && proposal.speaker_id === request.user!.id) return reply.notFound('Proposal not found');
    const review = await app.app.db
      .insertInto('reviews')
      .values({
        proposal_id: proposal.id,
        reviewer_id: request.user!.id,
        score,
        comments: stripHtml(body.comments ?? '')
      })
      .onConflict((oc) =>
        oc.columns(['proposal_id', 'reviewer_id']).doUpdateSet({
          score,
          comments: stripHtml(body.comments ?? '')
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow();
    await audit(app.app.db, request.user!.id, 'review.upserted', 'review', review.id, { proposalId: proposal.id });
    return { review };
  });

  app.patch('/reviews/:id', { preHandler: app.requireRole(['admin', 'reviewer']) }, async (request, reply) => {
    try {
      await assertReviewsOpen(app.app.db);
    } catch {
      return reply.badRequest('Reviews are not open');
    }
    const { id } = request.params as { id: string };
    const body = request.body as { score?: number; comments?: string };
    if (body.score !== undefined && (!Number.isInteger(body.score) || body.score < 1 || body.score > 10)) return reply.badRequest('Score must be between 1 and 10');
    const current = await app.app.db
      .selectFrom('reviews')
      .innerJoin('proposals', 'proposals.id', 'reviews.proposal_id')
      .select(['reviews.id', 'reviews.proposal_id', 'proposals.status'])
      .where('reviews.id', '=', id)
      .where('reviews.reviewer_id', '=', request.user!.id)
      .executeTakeFirst();
    if (!current) return reply.notFound('Review not found');
    if (current.status !== 'under_review') return reply.badRequest('Review is locked');
    const review = await app.app.db
      .updateTable('reviews')
      .set({
        score: body.score,
        comments: body.comments === undefined ? undefined : stripHtml(body.comments)
      })
      .where('id', '=', id)
      .where('reviewer_id', '=', request.user!.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await audit(app.app.db, request.user!.id, 'review.updated', 'review', review.id);
    return { review };
  });
};
