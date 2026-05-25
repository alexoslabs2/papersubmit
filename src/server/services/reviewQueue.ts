import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.js';

export interface ReviewQueueItem {
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
  description: string;
  key_takeaways: string;
  related_tools: string;
  additional_notes: string;
  status: string;
  speaker_name: string;
  review_id: string | null;
  score: number | null;
  comments: string | null;
}

export async function listReviewerQueue(db: Kysely<Database>, reviewerId: string): Promise<ReviewQueueItem[]> {
  return db
    .selectFrom('proposals')
    .innerJoin('users', 'users.id', 'proposals.speaker_id')
    .leftJoin('reviews', (join) => join.onRef('reviews.proposal_id', '=', 'proposals.id').on('reviews.reviewer_id', '=', reviewerId))
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
      'users.name as speaker_name',
      'reviews.id as review_id',
      'reviews.score',
      'reviews.comments'
    ])
    .where('proposals.status', '=', 'under_review')
    .where('proposals.speaker_id', '!=', reviewerId)
    .where('proposals.deleted_at', 'is', null)
    .orderBy('proposals.created_at', 'asc')
    .execute();
}
