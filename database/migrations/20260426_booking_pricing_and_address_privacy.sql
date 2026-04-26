-- Booking + pricing + address/privacy updates

-- 1) Saved client addresses
CREATE TABLE IF NOT EXISTS public.client_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label TEXT,
  address_line1 TEXT NOT NULL,
  city TEXT NOT NULL,
  postcode TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'IE',
  apartment_details TEXT,
  access_notes TEXT NOT NULL,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_addresses_client_id ON public.client_addresses(client_id);
CREATE INDEX IF NOT EXISTS idx_client_addresses_is_default ON public.client_addresses(client_id, is_default);

CREATE TRIGGER trg_client_addresses_updated_at
  BEFORE UPDATE ON public.client_addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Keep a single default address per client
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_addresses_single_default
  ON public.client_addresses(client_id)
  WHERE is_default;

-- 2) Booking address detail fields
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS apartment_details TEXT,
  ADD COLUMN IF NOT EXISTS access_notes TEXT;

UPDATE public.bookings
SET access_notes = COALESCE(NULLIF(TRIM(access_notes), ''), 'No additional access notes provided.')
WHERE access_notes IS NULL OR TRIM(access_notes) = '';

ALTER TABLE public.bookings
  ALTER COLUMN access_notes SET NOT NULL;

-- 3) Pricing model refactor (Service subtotal + 10% platform fee; cleaner keeps full hourly subtotal)
UPDATE public.bookings
SET
  platform_fee_pct = 10.00,
  platform_fee = ROUND((subtotal * 0.10)::numeric, 2),
  cleaner_payout = ROUND(subtotal::numeric, 2),
  total_amount = ROUND((subtotal * 1.10)::numeric, 2)
WHERE status IN ('pending', 'accepted', 'confirmed', 'in_progress');

-- Keep payment records consistent for non-finalized bookings
UPDATE public.payments p
SET
  amount = b.total_amount,
  platform_fee = b.platform_fee,
  cleaner_payout = b.cleaner_payout
FROM public.bookings b
WHERE p.booking_id = b.id
  AND b.status IN ('pending', 'accepted', 'confirmed', 'in_progress')
  AND p.status IN ('pending', 'authorized');
