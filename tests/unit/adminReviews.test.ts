import { describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { averageReviewScore, listAdminProposalReviews } from '../../src/server/services/adminReviews.js';
import type { Database } from '../../src/server/db/schema.js';

interface ReviewState {
  reviews: Array<{
    id: string;
    proposal_id: string;
    reviewer_id: string;
    score: number;
    comments: string;
    created_at: Date;
    updated_at: Date;
  }>;
  users: Array<{ id: string; name: string; email: string }>;
}

class AdminReviewQuery {
  private proposalId = '';

  constructor(private readonly state: ReviewState) {}

  innerJoin() {
    return this;
  }

  select() {
    return this;
  }

  where(field: string, op: string, value: unknown) {
    expect([field, op]).toEqual(['reviews.proposal_id', '=']);
    this.proposalId = String(value);
    return this;
  }

  orderBy() {
    return this;
  }

  async execute() {
    return this.state.reviews
      .filter((review) => review.proposal_id === this.proposalId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      .map((review) => {
        const reviewer = this.state.users.find((user) => user.id === review.reviewer_id);
        return {
          ...review,
          reviewer_name: reviewer?.name ?? '',
          reviewer_email: reviewer?.email ?? ''
        };
      });
  }
}

class AdminReviewDb {
  constructor(private readonly state: ReviewState) {}

  selectFrom(table: string) {
    expect(table).toBe('reviews');
    return new AdminReviewQuery(this.state);
  }
}

describe('admin review summaries', () => {
  it('returns reviewer scores and comments for the selected proposal', async () => {
    const state: ReviewState = {
      users: [
        { id: 'reviewer-1', name: 'Ada Reviewer', email: 'ada@example.com' },
        { id: 'reviewer-2', name: 'Grace Reviewer', email: 'grace@example.com' }
      ],
      reviews: [
        {
          id: 'review-2',
          proposal_id: 'proposal-1',
          reviewer_id: 'reviewer-2',
          score: 8,
          comments: 'Strong topic.',
          created_at: new Date('2026-05-02T00:00:00.000Z'),
          updated_at: new Date('2026-05-02T00:00:00.000Z')
        },
        {
          id: 'review-1',
          proposal_id: 'proposal-1',
          reviewer_id: 'reviewer-1',
          score: 7,
          comments: 'Clear abstract.',
          created_at: new Date('2026-05-01T00:00:00.000Z'),
          updated_at: new Date('2026-05-01T00:00:00.000Z')
        },
        {
          id: 'other-review',
          proposal_id: 'proposal-2',
          reviewer_id: 'reviewer-1',
          score: 3,
          comments: 'Hidden from this proposal.',
          created_at: new Date('2026-05-03T00:00:00.000Z'),
          updated_at: new Date('2026-05-03T00:00:00.000Z')
        }
      ]
    };

    const reviews = await listAdminProposalReviews(new AdminReviewDb(state) as unknown as Kysely<Database>, 'proposal-1');

    expect(reviews).toEqual([
      {
        id: 'review-1',
        proposalId: 'proposal-1',
        reviewerId: 'reviewer-1',
        reviewerName: 'Ada Reviewer',
        reviewerEmail: 'ada@example.com',
        score: 7,
        comments: 'Clear abstract.',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z'
      },
      {
        id: 'review-2',
        proposalId: 'proposal-1',
        reviewerId: 'reviewer-2',
        reviewerName: 'Grace Reviewer',
        reviewerEmail: 'grace@example.com',
        score: 8,
        comments: 'Strong topic.',
        createdAt: '2026-05-02T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z'
      }
    ]);
    expect(averageReviewScore(reviews)).toBe(7.5);
  });
});
