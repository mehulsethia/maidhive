ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_transfer_reversal_id TEXT,
  ADD COLUMN IF NOT EXISTS transfer_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS transfer_reversed_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS transfer_reversed_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS transfer_reversal_status TEXT;

CREATE INDEX IF NOT EXISTS payments_transfer_reversed_at_idx
  ON public.payments (transfer_reversed_at);
