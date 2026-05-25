import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';
import type { EmailJobStatus, EmailTriggerType, EventStatus, ProposalStatus, ScoringScale, TalkFormat, UserRole } from '../../shared/types.js';

type Timestamp = ColumnType<Date, Date | string, Date | string>;
type GeneratedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface UsersTable {
  id: Generated<string>;
  email: string;
  name: string;
  role: UserRole;
  password_hash: string;
  failed_login_attempts: Generated<number>;
  locked_until: Timestamp | null;
  deleted_at: Timestamp | null;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  created_at: GeneratedTimestamp;
  last_seen_at: GeneratedTimestamp;
  expires_at: Timestamp;
}

export interface SetupConfigTable {
  id: Generated<number>;
  token_hash: string | null;
  completed_at: Timestamp | null;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface EventTable {
  id: Generated<number>;
  name: string;
  slug: string;
  location: string | null;
  start_date: Timestamp;
  end_date: Timestamp;
  timezone: string;
  description: string | null;
  code_of_conduct: string | null;
  status: EventStatus;
  cfp_opens_at: Timestamp;
  cfp_closes_at: Timestamp;
  cfp_description: string | null;
  talk_formats: TalkFormat[];
  scoring_scale: ScoringScale;
  min_reviews_required: number;
  travel_assistance: string | null;
  logo_path: string | null;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface ProposalsTable {
  id: Generated<string>;
  speaker_id: string;
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
  status: ProposalStatus;
  decided_at: Timestamp | null;
  deleted_at: Timestamp | null;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface ReviewsTable {
  id: Generated<string>;
  proposal_id: string;
  reviewer_id: string;
  score: number;
  comments: string;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface ReviewerInvitationsTable {
  id: Generated<string>;
  email: string;
  token_hash: string;
  accepted_at: Timestamp | null;
  expires_at: Timestamp;
  created_at: GeneratedTimestamp;
}

export interface PasswordResetTokensTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  used_at: Timestamp | null;
  expires_at: Timestamp;
  created_at: GeneratedTimestamp;
}

export interface SmtpSettingsTable {
  id: Generated<number>;
  host: string;
  port: number;
  username: string | null;
  encrypted_password: string | null;
  from_email: string;
  from_name: string;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface EmailTemplatesTable {
  id: Generated<string>;
  name: string;
  trigger_type: EmailTriggerType;
  subject: string;
  html_body: string;
  text_body: string;
  required_variables: Generated<string[]>;
  is_system: Generated<boolean>;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface EmailJobsTable {
  id: Generated<string>;
  template_id: string | null;
  trigger_type: EmailTriggerType;
  recipient_email: string;
  subject: string;
  html_body: string;
  text_body: string;
  status: EmailJobStatus;
  attempts: Generated<number>;
  available_at: GeneratedTimestamp;
  processing_started_at: Timestamp | null;
  sent_at: Timestamp | null;
  error_message: string | null;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface AuditLogsTable {
  id: Generated<number>;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Generated<Record<string, unknown>>;
  created_at: GeneratedTimestamp;
}

export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  setup_config: SetupConfigTable;
  event: EventTable;
  proposals: ProposalsTable;
  reviews: ReviewsTable;
  reviewer_invitations: ReviewerInvitationsTable;
  password_reset_tokens: PasswordResetTokensTable;
  smtp_settings: SmtpSettingsTable;
  email_templates: EmailTemplatesTable;
  email_jobs: EmailJobsTable;
  audit_logs: AuditLogsTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;
export type EventRow = Selectable<EventTable>;
export type ProposalRow = Selectable<ProposalsTable>;
export type NewProposal = Insertable<ProposalsTable>;
