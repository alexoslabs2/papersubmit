import { describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { listReviewerQueue } from '../../src/server/services/reviewQueue.js';
import { transitionExpiredOpenEvent, updateEvent } from '../../src/server/services/events.js';
import type { Database, EventRow } from '../../src/server/db/schema.js';

const reviewerId = '00000000-0000-7000-8000-000000000001';
const speakerId = '00000000-0000-7000-8000-000000000002';
const otherSpeakerId = '00000000-0000-7000-8000-000000000003';

function event(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: 1,
    name: 'Conf',
    slug: 'conf',
    location: null,
    start_date: new Date('2026-06-01T00:00:00.000Z'),
    end_date: new Date('2026-06-02T00:00:00.000Z'),
    timezone: 'UTC',
    description: null,
    code_of_conduct: null,
    status: 'open',
    cfp_opens_at: new Date('2026-05-01T00:00:00.000Z'),
    cfp_closes_at: new Date('2026-05-20T00:00:00.000Z'),
    cfp_description: null,
    talk_formats: ['talk'],
    scoring_scale: 'SCALE_1_5',
    min_reviews_required: 1,
    travel_assistance: null,
    logo_path: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides
  };
}

class ReviewQueueQuery {
  private reviewerForReviewJoin = '';
  private wheres: Array<[string, string, unknown]> = [];

  constructor(private readonly state: ReviewQueueState) {}

  innerJoin() {
    return this;
  }

  leftJoin(_table: string, callback: (join: { onRef: () => { on: (_field: string, _op: string, value: string) => unknown } }) => unknown) {
    callback({
      onRef: () => ({
        on: (_field: string, _op: string, value: string) => {
          this.reviewerForReviewJoin = value;
          return this;
        }
      })
    });
    return this;
  }

  select() {
    return this;
  }

  where(field: string, op: string, value: unknown) {
    this.wheres.push([field, op, value]);
    return this;
  }

  orderBy() {
    return this;
  }

  async execute() {
    return this.state.proposals
      .filter((proposal) => this.wheres.every(([field, op, value]) => {
        if (field === 'proposals.status' && op === '=') return proposal.status === value;
        if (field === 'proposals.speaker_id' && op === '!=') return proposal.speaker_id !== value;
        if (field === 'proposals.deleted_at' && op === 'is') return proposal.deleted_at === value;
        return true;
      }))
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      .map((proposal) => {
        const user = this.state.users.find((row) => row.id === proposal.speaker_id);
        const review = this.state.reviews.find((row) => row.proposal_id === proposal.id && row.reviewer_id === this.reviewerForReviewJoin);
        return {
          id: proposal.id,
          title: proposal.title,
          abstract: proposal.abstract,
          status: proposal.status,
          speaker_name: user?.name ?? '',
          review_id: review?.id ?? null,
          score: review?.score ?? null,
          comments: review?.comments ?? null
        };
      });
  }
}

interface ReviewQueueState {
  users: Array<{ id: string; name: string }>;
  proposals: Array<{ id: string; speaker_id: string; title: string; abstract: string; status: string; deleted_at: Date | null; created_at: Date }>;
  reviews: Array<{ id: string; proposal_id: string; reviewer_id: string; score: number; comments: string }>;
}

class ReviewQueueDb {
  constructor(private readonly state: ReviewQueueState) {}

  selectFrom(table: string) {
    expect(table).toBe('proposals');
    return new ReviewQueueQuery(this.state);
  }
}

class LifecycleQuery {
  private update: Partial<EventRow> | Record<string, unknown> = {};
  private wheres: Array<[string, string, unknown]> = [];

  constructor(private readonly state: LifecycleState, private readonly table: string) {}

  selectAll() {
    return this;
  }

  select() {
    return this;
  }

  set(update: Partial<EventRow> | Record<string, unknown>) {
    this.update = update;
    return this;
  }

  where(field: string, op: string, value: unknown) {
    this.wheres.push([field, op, value]);
    return this;
  }

  returningAll() {
    return this;
  }

  values(value: unknown) {
    this.state.auditLogs.push(value);
    return this;
  }

  async executeTakeFirst() {
    if (this.table === 'event') return this.state.event;
    if (this.table === 'reviews') return { count: this.state.reviewCount };
    return undefined;
  }

  async executeTakeFirstOrThrow() {
    if (this.table !== 'event') throw new Error(`Unexpected returning table ${this.table}`);
    this.state.event = { ...this.state.event, ...this.update } as EventRow;
    return this.state.event;
  }

  async execute() {
    if (this.table === 'proposals') {
      const proposalUpdate = this.update as Partial<LifecycleState['proposals'][number]>;
      this.state.proposals = this.state.proposals.map((proposal) => {
        const matches = this.wheres.every(([field, op, value]) => {
          if (field === 'status' && op === '=') return proposal.status === value;
          if (field === 'deleted_at' && op === 'is') return proposal.deleted_at === value;
          return true;
        });
        return matches ? { ...proposal, ...proposalUpdate } : proposal;
      });
    }
  }
}

interface LifecycleState {
  event: EventRow;
  reviewCount: number;
  proposals: Array<{ id: string; status: string; deleted_at: Date | null }>;
  auditLogs: unknown[];
}

class LifecycleDb {
  constructor(private readonly state: LifecycleState) {}

  transaction() {
    return {
      execute: async <T>(callback: (trx: LifecycleDb) => Promise<T>) => callback(this)
    };
  }

  selectFrom(table: string) {
    return new LifecycleQuery(this.state, table);
  }

  updateTable(table: string) {
    return new LifecycleQuery(this.state, table);
  }

  insertInto(table: string) {
    expect(table).toBe('audit_logs');
    return new LifecycleQuery(this.state, table);
  }
}

describe('reviewer lifecycle', () => {
  it('lists only under-review proposals that are not owned by the reviewer', async () => {
    const state: ReviewQueueState = {
      users: [
        { id: reviewerId, name: 'Reviewer' },
        { id: speakerId, name: 'Speaker' },
        { id: otherSpeakerId, name: 'Other Speaker' }
      ],
      proposals: [
        { id: 'submitted', speaker_id: speakerId, title: 'Submitted', abstract: 'Hidden', status: 'submitted', deleted_at: null, created_at: new Date('2026-05-01T00:00:00.000Z') },
        { id: 'reviewable', speaker_id: speakerId, title: 'Reviewable', abstract: 'Visible', status: 'under_review', deleted_at: null, created_at: new Date('2026-05-02T00:00:00.000Z') },
        { id: 'own', speaker_id: reviewerId, title: 'Own', abstract: 'Hidden', status: 'under_review', deleted_at: null, created_at: new Date('2026-05-03T00:00:00.000Z') },
        { id: 'deleted', speaker_id: speakerId, title: 'Deleted', abstract: 'Hidden', status: 'under_review', deleted_at: new Date('2026-05-04T00:00:00.000Z'), created_at: new Date('2026-05-04T00:00:00.000Z') },
        { id: 'completed', speaker_id: otherSpeakerId, title: 'Completed', abstract: 'Visible', status: 'under_review', deleted_at: null, created_at: new Date('2026-05-05T00:00:00.000Z') }
      ],
      reviews: [
        { id: 'review-1', proposal_id: 'completed', reviewer_id: reviewerId, score: 4, comments: 'Solid' },
        { id: 'review-2', proposal_id: 'reviewable', reviewer_id: otherSpeakerId, score: 2, comments: 'Private' }
      ]
    };

    const queue = await listReviewerQueue(new ReviewQueueDb(state) as unknown as Kysely<Database>, reviewerId);

    expect(queue.map((item) => item.id)).toEqual(['reviewable', 'completed']);
    expect(queue[0].review_id).toBeNull();
    expect(queue[0].comments).toBeNull();
    expect(queue[1].review_id).toBe('review-1');
    expect(queue[1].comments).toBe('Solid');
  });

  it('moves submitted proposals to under_review when review starts manually', async () => {
    const state: LifecycleState = {
      event: event({ status: 'open', cfp_closes_at: new Date('2026-05-30T00:00:00.000Z') }),
      reviewCount: 0,
      proposals: [
        { id: 'submitted', status: 'submitted', deleted_at: null },
        { id: 'withdrawn', status: 'withdrawn', deleted_at: null },
        { id: 'deleted', status: 'submitted', deleted_at: new Date('2026-05-01T00:00:00.000Z') }
      ],
      auditLogs: []
    };

    await updateEvent(new LifecycleDb(state) as unknown as Kysely<Database>, { status: 'reviewing' }, reviewerId);

    expect(state.event.status).toBe('reviewing');
    expect(state.proposals).toEqual([
      { id: 'submitted', status: 'under_review', deleted_at: null },
      { id: 'withdrawn', status: 'withdrawn', deleted_at: null },
      { id: 'deleted', status: 'submitted', deleted_at: new Date('2026-05-01T00:00:00.000Z') }
    ]);
  });

  it('moves submitted proposals to under_review when the CFP closes automatically', async () => {
    const state: LifecycleState = {
      event: event({ status: 'open', cfp_closes_at: new Date('2026-01-01T00:00:00.000Z') }),
      reviewCount: 0,
      proposals: [{ id: 'submitted', status: 'submitted', deleted_at: null }],
      auditLogs: []
    };

    await transitionExpiredOpenEvent(new LifecycleDb(state) as unknown as Kysely<Database>);

    expect(state.event.status).toBe('reviewing');
    expect(state.proposals[0].status).toBe('under_review');
  });
});
