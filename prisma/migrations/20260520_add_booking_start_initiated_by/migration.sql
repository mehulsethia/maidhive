ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS start_initiated_by TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_start_initiated_by_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_start_initiated_by_check
      CHECK (start_initiated_by IN ('cleaner', 'system'));
  END IF;
END $$;

UPDATE public.bookings
SET start_initiated_by = 'cleaner'
WHERE started_at IS NOT NULL
  AND start_initiated_by IS NULL
  AND status IN ('in_progress', 'completed', 'disputed');
