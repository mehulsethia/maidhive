ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
  CHECK (
    status IN (
      'pending',
      'authorized',
      'captured',
      'transferred',
      'refunded',
      'partially_refunded',
      'released',
      'failed'
    )
  );
