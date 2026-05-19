-- Backfill migration to replace runtime ensureDbSchema() guards.
-- Keep statements idempotent so deploys are safe across environments
-- with partially applied historical schema changes.

ALTER TABLE public.cleaners
ADD COLUMN IF NOT EXISTS id_file_url TEXT;

ALTER TABLE public.cleaners
ADD COLUMN IF NOT EXISTS cleaning_supplies TEXT,
ADD COLUMN IF NOT EXISTS pet_comfortable BOOLEAN,
ADD COLUMN IF NOT EXISTS work_eligibility_answer BOOLEAN,
ADD COLUMN IF NOT EXISTS cleaning_standards_accepted BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cleaning_quiz_score INTEGER,
ADD COLUMN IF NOT EXISTS cleaning_quiz_passed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS standards_completed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS quiz_passed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS quiz_score INTEGER;

UPDATE public.cleaners
SET
  standards_completed = COALESCE(standards_completed, cleaning_standards_accepted, FALSE),
  quiz_score = COALESCE(quiz_score, cleaning_quiz_score),
  quiz_passed = COALESCE(
    quiz_passed,
    CASE
      WHEN cleaning_quiz_score IS NOT NULL AND cleaning_quiz_score >= 80 AND cleaning_quiz_passed_at IS NOT NULL THEN TRUE
      ELSE FALSE
    END
  );

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS apartment_details TEXT,
ADD COLUMN IF NOT EXISTS access_notes TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_status_check'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings DROP CONSTRAINT bookings_status_check;
  END IF;
END $$;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_status_check
CHECK (
  status IN (
    'draft',
    'pending',
    'accepted',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'declined',
    'expired',
    'disputed'
  )
);

CREATE TABLE IF NOT EXISTS public.client_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label TEXT,
  address_line1 TEXT NOT NULL,
  city TEXT NOT NULL,
  postcode TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'IE',
  apartment_details TEXT,
  access_notes TEXT NOT NULL,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.client_addresses
ADD COLUMN IF NOT EXISTS label TEXT,
ADD COLUMN IF NOT EXISTS apartment_details TEXT,
ADD COLUMN IF NOT EXISTS access_notes TEXT,
ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6),
ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.client_addresses
SET access_notes = ''
WHERE access_notes IS NULL;

ALTER TABLE public.client_addresses
ALTER COLUMN access_notes SET DEFAULT '',
ALTER COLUMN access_notes SET NOT NULL;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS id_file_name TEXT,
ADD COLUMN IF NOT EXISTS id_file_url TEXT,
ADD COLUMN IF NOT EXISTS id_submitted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.client_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  cleaner_id UUID NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, cleaner_id)
);

CREATE INDEX IF NOT EXISTS idx_client_favorites_client_id ON public.client_favorites(client_id);
CREATE INDEX IF NOT EXISTS idx_client_favorites_cleaner_id ON public.client_favorites(cleaner_id);

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.phone_verification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  event_type TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_verification_events_phone_event_created
ON public.phone_verification_events(phone, event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_phone_verification_events_user_created
ON public.phone_verification_events(user_id, created_at);
