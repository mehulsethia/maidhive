-- Client trust-signal fields for optional ID submission
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS id_file_name TEXT,
  ADD COLUMN IF NOT EXISTS id_file_url TEXT,
  ADD COLUMN IF NOT EXISTS id_submitted_at TIMESTAMPTZ;
