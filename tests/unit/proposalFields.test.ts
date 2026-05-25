import { describe, expect, it } from 'vitest';
import { validateAndSanitizeProposalPayload } from '../../src/server/services/proposalFields.js';

const validPayload = {
  speakerFullName: 'Ada Lovelace',
  speakerContactEmail: 'ada@example.com',
  companyOrganization: 'Analytical Engines Ltd',
  country: 'United Kingdom',
  speakerBio: 'Writes about computing.',
  onlinePresence: 'https://example.com/ada',
  title: 'Programming the Engine',
  presentationLanguages: ['english'],
  technicalLevel: 'advanced',
  abstract: 'A short abstract.',
  description: 'A detailed description.',
  keyTakeaways: 'Practical architecture lessons.',
  relatedTools: 'https://github.com/example/engine',
  additionalNotes: 'No special notes.'
};

describe('proposal field validation', () => {
  it('sanitizes text and accepts valid proposal fields', () => {
    const result = validateAndSanitizeProposalPayload({
      ...validPayload,
      title: '<strong>Programming the Engine</strong>'
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        title: 'Programming the Engine',
        speaker_contact_email: 'ada@example.com',
        presentation_languages: ['english'],
        technical_level: 'advanced'
      }
    });
  });

  it('rejects values beyond configured character limits', () => {
    const result = validateAndSanitizeProposalPayload({
      ...validPayload,
      abstract: 'a'.repeat(1001)
    });

    expect(result).toEqual({ ok: false, error: 'Abstract must be 1000 characters or fewer' });
  });

  it('rejects invalid language and technical level options', () => {
    expect(validateAndSanitizeProposalPayload({
      ...validPayload,
      presentationLanguages: ['spanish']
    })).toEqual({ ok: false, error: 'Presentation language is invalid' });

    expect(validateAndSanitizeProposalPayload({
      ...validPayload,
      technicalLevel: 'beginner'
    })).toEqual({ ok: false, error: 'Technical level is required' });
  });
});
