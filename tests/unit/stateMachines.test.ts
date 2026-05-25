import { describe, expect, it } from 'vitest';
import { canTransitionEvent, canTransitionProposal, isCfpOpen } from '../../src/shared/stateMachines.js';

describe('state machines', () => {
  it('allows only one-way event transitions', () => {
    expect(canTransitionEvent('draft', 'open')).toBe(true);
    expect(canTransitionEvent('open', 'reviewing')).toBe(true);
    expect(canTransitionEvent('reviewing', 'closed')).toBe(true);
    expect(canTransitionEvent('open', 'draft')).toBe(false);
    expect(canTransitionEvent('reviewing', 'open')).toBe(false);
    expect(canTransitionEvent('closed', 'reviewing')).toBe(false);
  });

  it('allows only v4 proposal transitions', () => {
    expect(canTransitionProposal('submitted', 'under_review')).toBe(true);
    expect(canTransitionProposal('under_review', 'accepted')).toBe(true);
    expect(canTransitionProposal('accepted', 'rejected')).toBe(false);
  });

  it('requires open status and date window for submissions', () => {
    const now = new Date('2026-01-01T12:00:00.000Z');
    expect(isCfpOpen({ status: 'open', cfpOpensAt: new Date('2026-01-01T00:00:00.000Z'), cfpClosesAt: new Date('2026-01-02T00:00:00.000Z') }, now)).toBe(true);
    expect(isCfpOpen({ status: 'reviewing', cfpOpensAt: new Date('2026-01-01T00:00:00.000Z'), cfpClosesAt: new Date('2026-01-02T00:00:00.000Z') }, now)).toBe(false);
  });
});
