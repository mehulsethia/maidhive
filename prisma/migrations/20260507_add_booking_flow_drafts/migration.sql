CREATE TABLE IF NOT EXISTS public.booking_flow_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  cleaner_id uuid NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
  booking_id uuid UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  last_step integer NOT NULL DEFAULT 1,
  duration_hours numeric(4,2),
  selected_date text,
  selected_slot timestamptz,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_flow_drafts_client_cleaner_key UNIQUE (client_id, cleaner_id)
);

CREATE INDEX IF NOT EXISTS booking_flow_drafts_client_updated_idx
  ON public.booking_flow_drafts (client_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS booking_flow_drafts_cleaner_updated_idx
  ON public.booking_flow_drafts (cleaner_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_booking_flow_drafts_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_flow_drafts_updated_at ON public.booking_flow_drafts;
CREATE TRIGGER trg_booking_flow_drafts_updated_at
BEFORE UPDATE ON public.booking_flow_drafts
FOR EACH ROW EXECUTE FUNCTION public.set_booking_flow_drafts_updated_at();
