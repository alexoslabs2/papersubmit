import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.js';
import type { ProposalReviewSummary } from '../../shared/types.js';

export async function listAdminProposalReviews(db: Kysely<Database>, proposalId: string): Promise<ProposalReviewSummary[]> {
  const rows = await db
    .selectFrom('reviews')
    .innerJoin('users', 'users.id', 'reviews.reviewer_id')
    .select([
      'reviews.id',
      'reviews.proposal_id',
      'reviews.reviewer_id',
      'reviews.score',
      'reviews.comments',
      'reviews.created_at',
      'reviews.updated_at',
      'users.name as reviewer_name',
      'users.email as reviewer_email'
    ])
    .where('reviews.proposal_id', '=', proposalId)
    .orderBy('reviews.created_at', 'asc')
    .execute();

  return rows.map((row) => ({
    id: row.id,
    proposalId: row.proposal_id,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name,
    reviewerEmail: row.reviewer_email,
    score: row.score,
    comments: row.comments,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }));
}

export function averageReviewScore(reviews: Pick<ProposalReviewSummary, 'score'>[]): number | null {
  if (reviews.length === 0) return null;
  const total = reviews.reduce((sum, review) => sum + review.score, 0);
  return Math.round((total / reviews.length) * 10) / 10;
}
