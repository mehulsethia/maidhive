ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS issue_type TEXT,
  ADD COLUMN IF NOT EXISTS explanation TEXT;
