export type UserRole = 'admin' | 'reviewer' | 'speaker';
export type EventStatus = 'draft' | 'open' | 'reviewing' | 'closed';
export type ProposalStatus = 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'withdrawn';
export type TalkFormat = 'talk' | 'lightning' | 'workshop';
export type ScoringScale = 'SCALE_1_5' | 'SCALE_1_10';
export type EmailJobStatus = 'queued' | 'retrying' | 'processing' | 'sent' | 'failed';
export type EmailTriggerType =
  | 'speaker_registered'
  | 'proposal_submitted'
  | 'reviewer_invited'
  | 'password_reset'
  | 'proposal_accepted'
  | 'proposal_rejected';

export interface PublicEvent {
  id: number;
  name: string;
  slug: string;
  location: string | null;
  startDate: string;
  endDate: string;
  timezone: string;
  description: string | null;
  codeOfConduct: string | null;
  status: EventStatus;
  cfpOpensAt: string;
  cfpClosesAt: string;
  cfpDescription: string | null;
  talkFormats: TalkFormat[];
  scoringScale: ScoringScale;
  minReviewsRequired: number;
  travelAssistance: string | null;
  logoUrl: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface ProposalSummary {
  id: string;
  speakerFullName: string;
  speakerContactEmail: string;
  companyOrganization: string;
  country: string;
  speakerBio: string;
  onlinePresence: string;
  title: string;
  presentationLanguages: string[];
  technicalLevel: string;
  abstract: string;
  description?: string;
  keyTakeaways: string;
  relatedTools: string;
  additionalNotes: string;
  status: ProposalStatus;
  speakerName: string;
  speakerId: string;
  createdAt: string;
  updatedAt: string;
  reviews?: ProposalReviewSummary[];
  reviewCount?: number;
  averageScore?: number | null;
}

export interface ReviewSummary {
  id: string;
  proposalId: string;
  score: number;
  comments: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalReviewSummary extends ReviewSummary {
  reviewerId: string;
  reviewerName: string;
  reviewerEmail: string;
}

export interface WorkerHealth {
  lastRunAt: string | null;
  pendingJobs?: number;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  db: 'ok' | 'error';
  worker: {
    email: WorkerHealth;
    sessionPurge: WorkerHealth;
  };
}
