-- Booking list/query latency hardening for client/cleaner/admin pages.
CREATE INDEX IF NOT EXISTS bookings_client_created_desc_idx
  ON public.bookings (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS bookings_cleaner_created_desc_idx
  ON public.bookings (cleaner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS bookings_client_status_created_desc_idx
  ON public.bookings (client_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS bookings_cleaner_status_created_desc_idx
  ON public.bookings (cleaner_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS bookings_status_created_desc_idx
  ON public.bookings (status, created_at DESC);

CREATE INDEX IF NOT EXISTS bookings_status_accept_by_idx
  ON public.bookings (status, accept_by);

CREATE INDEX IF NOT EXISTS bookings_status_completed_at_idx
  ON public.bookings (status, completed_at);

CREATE INDEX IF NOT EXISTS bookings_cleaner_schedule_idx
  ON public.bookings (cleaner_id, scheduled_start, scheduled_end);

CREATE INDEX IF NOT EXISTS payments_status_booking_idx
  ON public.payments (status, booking_id);

CREATE INDEX IF NOT EXISTS payments_authorized_at_idx
  ON public.payments (authorized_at);

CREATE INDEX IF NOT EXISTS payments_captured_at_idx
  ON public.payments (captured_at);

CREATE INDEX IF NOT EXISTS payments_transferred_at_idx
  ON public.payments (transferred_at);
