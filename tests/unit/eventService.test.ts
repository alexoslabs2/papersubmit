import { describe, expect, it } from 'vitest';
import { assertEventUpdateAllowed, buildEventUpdate, normalizeSlug, validateTimezone } from '../../src/server/services/events.js';
import type { EventRow } from '../../src/server/db/schema.js';

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
    status: 'draft',
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

describe('event service validation', () => {
  it('normalizes URL-safe slugs', () => {
    expect(normalizeSlug(' CFP São Paulo 2026! ')).toBe('cfp-s-o-paulo-2026');
  });

  it('validates IANA timezones', () => {
    expect(validateTimezone('America/Bahia')).toBe(true);
    expect(validateTimezone('Nope/Nowhere')).toBe(false);
  });

  it('allows only description and code of conduct after review starts', () => {
    expect(() => assertEventUpdateAllowed(event({ status: 'reviewing' }), { description: 'Updated' }, false)).not.toThrow();
    expect(() => assertEventUpdateAllowed(event({ status: 'reviewing' }), { name: 'New name' }, false)).toThrow(/Only description/);
  });

  it('locks scoring scale after the first review', () => {
    expect(() => assertEventUpdateAllowed(event(), { scoringScale: 'SCALE_1_10' }, true)).toThrow(/Scoring scale/);
  });

  it('rejects invalid event date windows', () => {
    expect(() => buildEventUpdate(event(), { cfpOpensAt: '2026-05-20T00:00:00.000Z', cfpClosesAt: '2026-05-01T00:00:00.000Z' })).toThrow(/CFP opens/);
  });

  it('allows event description fields up to 1000 characters', () => {
    const text = 'a'.repeat(1000);
    const next = buildEventUpdate(event(), {
      description: text,
      cfpDescription: text,
      codeOfConduct: text
    });

    expect(next.description).toBe(text);
    expect(next.cfp_description).toBe(text);
    expect(next.code_of_conduct).toBe(text);
  });

  it('rejects event description fields over 1000 characters', () => {
    expect(() => buildEventUpdate(event(), { description: 'a'.repeat(1001) })).toThrow(/1000 characters/);
    expect(() => buildEventUpdate(event(), { cfpDescription: 'a'.repeat(1001) })).toThrow(/1000 characters/);
    expect(() => buildEventUpdate(event(), { codeOfConduct: 'a'.repeat(1001) })).toThrow(/1000 characters/);
  });
});
