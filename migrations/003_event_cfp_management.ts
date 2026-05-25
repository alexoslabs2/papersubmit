import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    DO $$
    BEGIN
      IF to_regclass('public.events') IS NOT NULL AND to_regclass('public.event') IS NULL THEN
        ALTER TABLE events RENAME TO event;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF to_regclass('public.event') IS NOT NULL THEN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'event'
            AND column_name = 'id'
            AND data_type = 'uuid'
        ) THEN
          DELETE FROM event
          WHERE id::text NOT IN (
            SELECT id::text FROM event ORDER BY created_at ASC LIMIT 1
          );

          ALTER TABLE event DROP CONSTRAINT IF EXISTS events_pkey;
          ALTER TABLE event DROP CONSTRAINT IF EXISTS event_pkey;
          ALTER TABLE event DROP COLUMN id;
          ALTER TABLE event ADD COLUMN id integer NOT NULL DEFAULT 1;
          ALTER TABLE event ADD CONSTRAINT event_pkey PRIMARY KEY (id);
        END IF;
      END IF;
    END $$;

    ALTER TABLE event ADD CONSTRAINT event_single_row CHECK (id = 1);
    ALTER TABLE event ALTER COLUMN id SET DEFAULT 1;
    ALTER TABLE event ALTER COLUMN description DROP NOT NULL;

    ALTER TABLE event ADD COLUMN IF NOT EXISTS location text;
    ALTER TABLE event ADD COLUMN IF NOT EXISTS start_date timestamptz;
    ALTER TABLE event ADD COLUMN IF NOT EXISTS end_date timestamptz;
    ALTER TABLE event ADD COLUMN IF NOT EXISTS code_of_conduct text;
    ALTER TABLE event ADD COLUMN IF NOT EXISTS cfp_description text;
    ALTER TABLE event ADD COLUMN IF NOT EXISTS talk_formats text[] NOT NULL DEFAULT ARRAY['talk', 'lightning', 'workshop']::text[];
    ALTER TABLE event ADD COLUMN IF NOT EXISTS scoring_scale text NOT NULL DEFAULT 'SCALE_1_5';
    ALTER TABLE event ADD COLUMN IF NOT EXISTS min_reviews_required integer NOT NULL DEFAULT 1;
    ALTER TABLE event ADD COLUMN IF NOT EXISTS travel_assistance text;

    UPDATE event
    SET
      start_date = COALESCE(start_date, cfp_opens_at),
      end_date = COALESCE(end_date, cfp_closes_at),
      cfp_description = COALESCE(cfp_description, description)
    WHERE id = 1;

    ALTER TABLE event ALTER COLUMN start_date SET NOT NULL;
    ALTER TABLE event ALTER COLUMN end_date SET NOT NULL;

    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_name_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_slug_format;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_location_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_date_order;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_timezone_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_description_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_code_of_conduct_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_cfp_window;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_cfp_description_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_talk_formats_not_empty;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_talk_formats_allowed;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_scoring_scale_allowed;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_min_reviews_required;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_travel_assistance_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_status_allowed;

    ALTER TABLE event ADD CONSTRAINT event_name_length CHECK (char_length(name) BETWEEN 1 AND 200);
    ALTER TABLE event ADD CONSTRAINT event_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
    ALTER TABLE event ADD CONSTRAINT event_location_length CHECK (location IS NULL OR char_length(location) <= 255);
    ALTER TABLE event ADD CONSTRAINT event_date_order CHECK (start_date <= end_date);
    ALTER TABLE event ADD CONSTRAINT event_timezone_length CHECK (char_length(timezone) BETWEEN 1 AND 128);
    ALTER TABLE event ADD CONSTRAINT event_description_length CHECK (description IS NULL OR char_length(description) <= 1000);
    ALTER TABLE event ADD CONSTRAINT event_code_of_conduct_length CHECK (code_of_conduct IS NULL OR char_length(code_of_conduct) <= 1000);
    ALTER TABLE event ADD CONSTRAINT event_cfp_window CHECK (cfp_opens_at < cfp_closes_at);
    ALTER TABLE event ADD CONSTRAINT event_cfp_description_length CHECK (cfp_description IS NULL OR char_length(cfp_description) <= 1000);
    ALTER TABLE event ADD CONSTRAINT event_talk_formats_not_empty CHECK (array_length(talk_formats, 1) >= 1);
    ALTER TABLE event ADD CONSTRAINT event_talk_formats_allowed CHECK (talk_formats <@ ARRAY['talk', 'lightning', 'workshop']::text[]);
    ALTER TABLE event ADD CONSTRAINT event_scoring_scale_allowed CHECK (scoring_scale IN ('SCALE_1_5', 'SCALE_1_10'));
    ALTER TABLE event ADD CONSTRAINT event_min_reviews_required CHECK (min_reviews_required >= 1);
    ALTER TABLE event ADD CONSTRAINT event_travel_assistance_length CHECK (travel_assistance IS NULL OR char_length(travel_assistance) <= 100);
    ALTER TABLE event ADD CONSTRAINT event_status_allowed CHECK (status IN ('draft', 'open', 'reviewing', 'closed'));

    ALTER TABLE audit_logs ALTER COLUMN entity_id TYPE text USING entity_id::text;

    DROP TRIGGER IF EXISTS events_updated_at ON event;
    DROP TRIGGER IF EXISTS event_updated_at ON event;
    CREATE TRIGGER event_updated_at
    BEFORE UPDATE ON event
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TRIGGER IF EXISTS event_updated_at ON event;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_single_row;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_name_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_slug_format;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_location_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_date_order;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_timezone_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_description_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_code_of_conduct_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_cfp_window;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_cfp_description_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_talk_formats_not_empty;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_talk_formats_allowed;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_scoring_scale_allowed;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_min_reviews_required;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_travel_assistance_length;
    ALTER TABLE event DROP CONSTRAINT IF EXISTS event_status_allowed;
  `.execute(db);
}
