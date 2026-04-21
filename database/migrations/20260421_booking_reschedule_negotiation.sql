ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS proposed_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposed_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposal_by TEXT,
  ADD COLUMN IF NOT EXISTS cleaner_proposals INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_proposals INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_booking_proposal_by'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT chk_booking_proposal_by
      CHECK (proposal_by IS NULL OR proposal_by IN ('client', 'cleaner'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_booking_cleaner_proposals'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT chk_booking_cleaner_proposals
      CHECK (cleaner_proposals >= 0 AND cleaner_proposals <= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_booking_client_proposals'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT chk_booking_client_proposals
      CHECK (client_proposals >= 0 AND client_proposals <= 1);
  END IF;
END $$;
