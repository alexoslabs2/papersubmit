import type { EventStatus, ProposalStatus } from './types.js';

const eventTransitions: Record<EventStatus, EventStatus[]> = {
  draft: ['open'],
  open: ['reviewing'],
  reviewing: ['closed'],
  closed: []
};

const proposalTransitions: Record<ProposalStatus, ProposalStatus[]> = {
  submitted: ['withdrawn', 'under_review'],
  under_review: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
  withdrawn: []
};

export function canTransitionEvent(from: EventStatus, to: EventStatus): boolean {
  return eventTransitions[from].includes(to);
}

export function canTransitionProposal(from: ProposalStatus, to: ProposalStatus): boolean {
  return proposalTransitions[from].includes(to);
}

export function isCfpOpen(event: { status: EventStatus; cfpOpensAt: Date; cfpClosesAt: Date }, now = new Date()): boolean {
  return event.status === 'open' && event.cfpOpensAt <= now && event.cfpClosesAt >= now;
}

export function assertEventTransition(from: EventStatus, to: EventStatus): void {
  if (!canTransitionEvent(from, to)) {
    throw new Error(`Forbidden event transition: ${from} -> ${to}`);
  }
}

export function assertProposalTransition(from: ProposalStatus, to: ProposalStatus): void {
  if (!canTransitionProposal(from, to)) {
    throw new Error(`Forbidden proposal transition: ${from} -> ${to}`);
  }
}
