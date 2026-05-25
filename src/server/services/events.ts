import type { Kysely, Transaction } from 'kysely';
import { assertEventTransition, isCfpOpen } from '../../shared/stateMachines.js';
import type { EventStatus, PublicEvent, ScoringScale, TalkFormat } from '../../shared/types.js';
import type { Database, EventRow } from '../db/schema.js';
import { stripHtml } from '../security/sanitize.js';
import { audit } from './audit.js';

type DbLike = Kysely<Database> | Transaction<Database>;

const editableAfterOpen = new Set<keyof EventUpdateInput>(['description', 'codeOfConduct']);
const talkFormats: TalkFormat[] = ['talk', 'lightning', 'workshop'];
const scoringScales: ScoringScale[] = ['SCALE_1_5', 'SCALE_1_10'];
const eventLongTextMaxLength = 1000;

export interface EventUpdateInput {
  name?: string;
  slug?: string;
  location?: string | null;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  description?: string | null;
  codeOfConduct?: string | null;
  cfpOpensAt?: string;
  cfpClosesAt?: string;
  cfpDescription?: string | null;
  talkFormats?: TalkFormat[];
  scoringScale?: ScoringScale;
  minReviewsRequired?: number;
  travelAssistance?: string | null;
  status?: EventStatus;
}

export async function getSingleEvent(db: DbLike): Promise<EventRow | undefined> {
  return db.selectFrom('event').selectAll().where('id', '=', 1).executeTakeFirst();
}

export function publicEvent(event: EventRow): PublicEvent {
  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    location: event.location,
    startDate: event.start_date.toISOString(),
    endDate: event.end_date.toISOString(),
    timezone: event.timezone,
    description: event.description,
    codeOfConduct: event.code_of_conduct,
    status: event.status,
    cfpOpensAt: event.cfp_opens_at.toISOString(),
    cfpClosesAt: event.cfp_closes_at.toISOString(),
    cfpDescription: event.cfp_description,
    talkFormats: event.talk_formats,
    scoringScale: event.scoring_scale,
    minReviewsRequired: event.min_reviews_required,
    travelAssistance: event.travel_assistance,
    logoUrl: event.logo_path ? `/uploads/event-logo/${event.logo_path}` : null
  };
}

export function validateTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function assertEventUpdateAllowed(current: EventRow, input: EventUpdateInput, hasReviews: boolean): void {
  const changedFields = (Object.keys(input) as (keyof EventUpdateInput)[]).filter((key) => key !== 'status' && input[key] !== undefined);
  if (current.status === 'reviewing' || current.status === 'closed') {
    const blocked = changedFields.filter((key) => !editableAfterOpen.has(key));
    if (blocked.length > 0) throw new Error('Only description and code of conduct may be edited after CFP review starts');
  }

  if (input.status && input.status !== current.status) {
    assertEventTransition(current.status, input.status);
  }

  if (input.scoringScale && input.scoringScale !== current.scoring_scale && hasReviews) {
    throw new Error('Scoring scale is locked after the first review');
  }
}

export function buildEventUpdate(current: EventRow, input: EventUpdateInput): Partial<EventRow> {
  const next = {
    name: cleanText(input.name, 200, current.name, true),
    slug: input.slug === undefined ? current.slug : normalizeSlug(input.slug),
    location: cleanNullableText(input.location, 255, current.location),
    start_date: parseDate(input.startDate, current.start_date, 'Start date'),
    end_date: parseDate(input.endDate, current.end_date, 'End date'),
    timezone: input.timezone ?? current.timezone,
    description: cleanNullableText(input.description, eventLongTextMaxLength, current.description),
    code_of_conduct: cleanNullableText(input.codeOfConduct, eventLongTextMaxLength, current.code_of_conduct),
    cfp_opens_at: parseDate(input.cfpOpensAt, current.cfp_opens_at, 'CFP opens at'),
    cfp_closes_at: parseDate(input.cfpClosesAt, current.cfp_closes_at, 'CFP closes at'),
    cfp_description: cleanNullableText(input.cfpDescription, eventLongTextMaxLength, current.cfp_description),
    talk_formats: input.talkFormats ?? current.talk_formats,
    scoring_scale: input.scoringScale ?? current.scoring_scale,
    min_reviews_required: input.minReviewsRequired ?? current.min_reviews_required,
    travel_assistance: cleanNullableText(input.travelAssistance, 100, current.travel_assistance),
    status: input.status ?? current.status
  };

  validateEventValues(next);
  return next;
}

export async function updateEvent(db: Kysely<Database>, input: EventUpdateInput, actorUserId: string): Promise<EventRow> {
  return db.transaction().execute(async (trx) => {
    const current = await getSingleEvent(trx);
    if (!current) throw new Error('Event is not configured');
    const reviewCount = await trx.selectFrom('reviews').select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirst();
    assertEventUpdateAllowed(current, input, Number(reviewCount?.count ?? 0) > 0);
    const next = buildEventUpdate(current, input);
    const event = await trx.updateTable('event').set(next).where('id', '=', 1).returningAll().executeTakeFirstOrThrow();
    if (input.status === 'reviewing' && current.status === 'open') {
      await moveSubmittedProposalsToReview(trx);
    }
    await audit(trx, actorUserId, 'event.updated', 'event', String(event.id), { status: event.status });
    return event;
  });
}

export async function transitionExpiredOpenEvent(db: Kysely<Database>): Promise<EventRow | undefined> {
  return db.transaction().execute(async (trx) => {
    const current = await getSingleEvent(trx);
    if (!current || current.status !== 'open' || current.cfp_closes_at > new Date()) return undefined;
    const event = await trx.updateTable('event').set({ status: 'reviewing' }).where('id', '=', 1).returningAll().executeTakeFirstOrThrow();
    await moveSubmittedProposalsToReview(trx);
    await audit(trx, null, 'event.auto_transitioned', 'event', String(event.id), { from: 'open', to: 'reviewing' });
    return event;
  });
}

export async function assertSubmissionsOpen(db: Kysely<Database>): Promise<EventRow> {
  const event = await getSingleEvent(db);
  if (!event || !isCfpOpen({ status: event.status, cfpOpensAt: event.cfp_opens_at, cfpClosesAt: event.cfp_closes_at })) {
    throw new Error('CFP is not open');
  }
  return event;
}

export async function assertReviewsOpen(db: Kysely<Database>): Promise<EventRow> {
  const event = await getSingleEvent(db);
  if (!event || event.status !== 'reviewing') throw new Error('Reviews are not open');
  return event;
}

export async function assertDecisionsOpen(db: Kysely<Database>): Promise<EventRow> {
  const event = await getSingleEvent(db);
  if (!event || event.status !== 'reviewing') throw new Error('Event is not reviewing');
  return event;
}

async function moveSubmittedProposalsToReview(db: DbLike): Promise<void> {
  await db.updateTable('proposals').set({ status: 'under_review' }).where('status', '=', 'submitted').where('deleted_at', 'is', null).execute();
}

function cleanText(value: string | undefined, maxLength: number, fallback: string, required = false): string {
  if (value === undefined) return fallback;
  const cleaned = stripHtml(value).trim();
  if (required && cleaned.length === 0) throw new Error('Required event fields cannot be empty');
  if (cleaned.length > maxLength) throw new Error(`Text value exceeds ${maxLength} characters`);
  return cleaned;
}

function cleanNullableText(value: string | null | undefined, maxLength: number, fallback: string | null): string | null {
  if (value === undefined) return fallback;
  if (value === null) return null;
  const cleaned = stripHtml(value).trim();
  if (cleaned.length > maxLength) throw new Error(`Text value exceeds ${maxLength} characters`);
  return cleaned.length === 0 ? null : cleaned;
}

function parseDate(value: string | undefined, fallback: Date, label: string): Date {
  if (value === undefined) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error(`${label} is invalid`);
  return date;
}

function validateEventValues(event: {
  name: string;
  slug: string;
  start_date: Date;
  end_date: Date;
  timezone: string;
  cfp_opens_at: Date;
  cfp_closes_at: Date;
  talk_formats: TalkFormat[];
  scoring_scale: ScoringScale;
  min_reviews_required: number;
}): void {
  if (!event.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.slug)) throw new Error('Slug must be URL-safe');
  if (event.start_date > event.end_date) throw new Error('Start date must be before or equal to end date');
  if (event.cfp_opens_at >= event.cfp_closes_at) throw new Error('CFP opens at must be before CFP closes at');
  if (!validateTimezone(event.timezone)) throw new Error('Timezone must be a valid IANA timezone');
  if (!Array.isArray(event.talk_formats) || event.talk_formats.length === 0) throw new Error('At least one talk format is required');
  if (!event.talk_formats.every((format) => talkFormats.includes(format))) throw new Error('Invalid talk format');
  if (!scoringScales.includes(event.scoring_scale)) throw new Error('Invalid scoring scale');
  if (!Number.isInteger(event.min_reviews_required) || event.min_reviews_required < 1) throw new Error('Minimum reviews required must be at least 1');
}
