ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS reporter_role TEXT,
  ADD COLUMN IF NOT EXISTS booking_status_at_report TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'disputes_reporter_role_check'
  ) THEN
    ALTER TABLE public.disputes
      ADD CONSTRAINT disputes_reporter_role_check
      CHECK (reporter_role IN ('client', 'cleaner', 'admin'));
  END IF;
END $$;
