import { stripHtml } from '../security/sanitize.js';

export const presentationLanguageOptions = ['portuguese', 'english', 'other'] as const;
export const technicalLevelOptions = ['intermediate', 'advanced', 'expert'] as const;

export type PresentationLanguage = (typeof presentationLanguageOptions)[number];
export type TechnicalLevel = (typeof technicalLevelOptions)[number];
const keyTakeawaysMaxLength = 500;

export interface ProposalPayload {
  speakerFullName?: string;
  speakerContactEmail?: string;
  companyOrganization?: string;
  country?: string;
  speakerBio?: string;
  onlinePresence?: string;
  title?: string;
  presentationLanguages?: string[];
  technicalLevel?: string;
  abstract?: string;
  description?: string;
  keyTakeaways?: string;
  relatedTools?: string;
  additionalNotes?: string;
}

export interface SanitizedProposalPayload {
  speaker_full_name: string;
  speaker_contact_email: string;
  company_organization: string;
  country: string;
  speaker_bio: string;
  online_presence: string;
  title: string;
  presentation_languages: PresentationLanguage[];
  technical_level: TechnicalLevel;
  abstract: string;
  description: string;
  key_takeaways: string;
  related_tools: string;
  additional_notes: string;
}

const textLimits: Array<[keyof ProposalPayload, keyof SanitizedProposalPayload, string, number]> = [
  ['speakerFullName', 'speaker_full_name', 'Full name', 80],
  ['speakerContactEmail', 'speaker_contact_email', 'Contact email', 80],
  ['companyOrganization', 'company_organization', 'Company / Organization', 80],
  ['country', 'country', 'Country', 80],
  ['speakerBio', 'speaker_bio', 'Speaker Bio', 500],
  ['onlinePresence', 'online_presence', 'Online Presence', 100],
  ['title', 'title', 'Talk title', 200],
  ['abstract', 'abstract', 'Abstract', 1000],
  ['description', 'description', 'Detailed description', 2000],
  ['keyTakeaways', 'key_takeaways', 'Key takeaways', keyTakeawaysMaxLength],
  ['relatedTools', 'related_tools', 'Related tools or repositories', 100],
  ['additionalNotes', 'additional_notes', 'Additional notes', 100]
];

function assertAllowed<T extends string>(value: string, allowed: readonly T[]): value is T {
  return allowed.includes(value as T);
}

export function validateAndSanitizeProposalPayload(body: ProposalPayload): { ok: true; value: SanitizedProposalPayload } | { ok: false; error: string } {
  const value = {} as SanitizedProposalPayload;

  for (const [inputKey, outputKey, label, limit] of textLimits) {
    const raw = body[inputKey];
    if (typeof raw !== 'string') return { ok: false, error: `${label} is required` };
    const clean = stripHtml(raw);
    if (!clean) return { ok: false, error: `${label} is required` };
    if (clean.length > limit) return { ok: false, error: `${label} must be ${limit} characters or fewer` };
    value[outputKey] = clean as never;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.speaker_contact_email)) {
    return { ok: false, error: 'Contact email must be a valid email address' };
  }

  const languages = body.presentationLanguages;
  if (!Array.isArray(languages) || languages.length === 0) return { ok: false, error: 'Presentation language is required' };
  const uniqueLanguages = [...new Set(languages.map((language) => String(language)))];
  if (!uniqueLanguages.every((language) => assertAllowed(language, presentationLanguageOptions))) {
    return { ok: false, error: 'Presentation language is invalid' };
  }
  value.presentation_languages = uniqueLanguages;

  if (typeof body.technicalLevel !== 'string' || !assertAllowed(body.technicalLevel, technicalLevelOptions)) {
    return { ok: false, error: 'Technical level is required' };
  }
  value.technical_level = body.technicalLevel;

  return { ok: true, value };
}

export function sanitizeProposalPatch(body: ProposalPayload): Partial<SanitizedProposalPayload> {
  const value: Partial<SanitizedProposalPayload> = {};

  for (const [inputKey, outputKey, , limit] of textLimits) {
    const raw = body[inputKey];
    if (typeof raw !== 'string') continue;
    const clean = stripHtml(raw);
    if (clean && clean.length <= limit) value[outputKey] = clean as never;
  }

  if (Array.isArray(body.presentationLanguages)) {
    const languages = [...new Set(body.presentationLanguages.map((language) => String(language)))];
    if (languages.length > 0 && languages.every((language) => assertAllowed(language, presentationLanguageOptions))) {
      value.presentation_languages = languages;
    }
  }

  if (typeof body.technicalLevel === 'string' && assertAllowed(body.technicalLevel, technicalLevelOptions)) {
    value.technical_level = body.technicalLevel;
  }

  return value;
}
