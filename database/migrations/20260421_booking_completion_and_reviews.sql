ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS started_latitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS started_longitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS started_accuracy_m INTEGER;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS cleaner_response TEXT,
  ADD COLUMN IF NOT EXISTS cleaner_responded_at TIMESTAMPTZ;
