ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS response_explanation TEXT,
  ADD COLUMN IF NOT EXISTS response_evidence JSONB,
  ADD COLUMN IF NOT EXISTS responded_by UUID,
  ADD COLUMN IF NOT EXISTS responder_role TEXT,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'disputes_responder_role_check'
  ) THEN
    ALTER TABLE public.disputes
      ADD CONSTRAINT disputes_responder_role_check
      CHECK (responder_role IN ('client', 'cleaner', 'admin'));
  END IF;
END $$;
