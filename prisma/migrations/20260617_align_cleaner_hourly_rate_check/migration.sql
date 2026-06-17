-- Align the database constraint with the application-visible cleaner rate range.
-- The app validates cleaner hourly_rate as EUR 6-25, but some environments had
-- an older cleaners_hourly_rate_check that rejected valid rates such as EUR 12.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cleaners_hourly_rate_check'
      AND conrelid = 'public.cleaners'::regclass
  ) THEN
    ALTER TABLE public.cleaners DROP CONSTRAINT cleaners_hourly_rate_check;
  END IF;
END $$;

ALTER TABLE public.cleaners
ADD CONSTRAINT cleaners_hourly_rate_check
CHECK (hourly_rate >= 6 AND hourly_rate <= 25);
