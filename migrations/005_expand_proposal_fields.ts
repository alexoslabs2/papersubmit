import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE proposals
      ADD COLUMN speaker_full_name text NOT NULL DEFAULT '',
      ADD COLUMN speaker_contact_email text NOT NULL DEFAULT '',
      ADD COLUMN company_organization text NOT NULL DEFAULT '',
      ADD COLUMN country text NOT NULL DEFAULT '',
      ADD COLUMN speaker_bio text NOT NULL DEFAULT '',
      ADD COLUMN online_presence text NOT NULL DEFAULT '',
      ADD COLUMN presentation_languages text[] NOT NULL DEFAULT '{}'::text[],
      ADD COLUMN technical_level text NOT NULL DEFAULT '',
      ADD COLUMN key_takeaways text NOT NULL DEFAULT '',
      ADD COLUMN related_tools text NOT NULL DEFAULT '',
      ADD COLUMN additional_notes text NOT NULL DEFAULT '';

    ALTER TABLE proposals
      ADD CONSTRAINT proposals_speaker_full_name_length CHECK (char_length(speaker_full_name) <= 80),
      ADD CONSTRAINT proposals_speaker_contact_email_length CHECK (char_length(speaker_contact_email) <= 80),
      ADD CONSTRAINT proposals_company_organization_length CHECK (char_length(company_organization) <= 80),
      ADD CONSTRAINT proposals_country_length CHECK (char_length(country) <= 80),
      ADD CONSTRAINT proposals_speaker_bio_length CHECK (char_length(speaker_bio) <= 500),
      ADD CONSTRAINT proposals_online_presence_length CHECK (char_length(online_presence) <= 100),
      ADD CONSTRAINT proposals_abstract_length CHECK (char_length(abstract) <= 1000),
      ADD CONSTRAINT proposals_description_length CHECK (char_length(description) <= 2000),
      ADD CONSTRAINT proposals_key_takeaways_length CHECK (char_length(key_takeaways) <= 100),
      ADD CONSTRAINT proposals_related_tools_length CHECK (char_length(related_tools) <= 100),
      ADD CONSTRAINT proposals_additional_notes_length CHECK (char_length(additional_notes) <= 100),
      ADD CONSTRAINT proposals_presentation_languages_allowed CHECK (presentation_languages <@ ARRAY['portuguese', 'english', 'other']::text[]),
      ADD CONSTRAINT proposals_technical_level_allowed CHECK (technical_level IN ('', 'intermediate', 'advanced', 'expert'));
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE proposals
      DROP CONSTRAINT IF EXISTS proposals_speaker_full_name_length,
      DROP CONSTRAINT IF EXISTS proposals_speaker_contact_email_length,
      DROP CONSTRAINT IF EXISTS proposals_company_organization_length,
      DROP CONSTRAINT IF EXISTS proposals_country_length,
      DROP CONSTRAINT IF EXISTS proposals_speaker_bio_length,
      DROP CONSTRAINT IF EXISTS proposals_online_presence_length,
      DROP CONSTRAINT IF EXISTS proposals_abstract_length,
      DROP CONSTRAINT IF EXISTS proposals_description_length,
      DROP CONSTRAINT IF EXISTS proposals_key_takeaways_length,
      DROP CONSTRAINT IF EXISTS proposals_related_tools_length,
      DROP CONSTRAINT IF EXISTS proposals_additional_notes_length,
      DROP CONSTRAINT IF EXISTS proposals_presentation_languages_allowed,
      DROP CONSTRAINT IF EXISTS proposals_technical_level_allowed;

    ALTER TABLE proposals
      DROP COLUMN IF EXISTS speaker_full_name,
      DROP COLUMN IF EXISTS speaker_contact_email,
      DROP COLUMN IF EXISTS company_organization,
      DROP COLUMN IF EXISTS country,
      DROP COLUMN IF EXISTS speaker_bio,
      DROP COLUMN IF EXISTS online_presence,
      DROP COLUMN IF EXISTS presentation_languages,
      DROP COLUMN IF EXISTS technical_level,
      DROP COLUMN IF EXISTS key_takeaways,
      DROP COLUMN IF EXISTS related_tools,
      DROP COLUMN IF EXISTS additional_notes;
  `.execute(db);
}
