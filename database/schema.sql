-- =============================================================================
-- MAIDHIVE DATABASE SCHEMA
-- PostgreSQL (Supabase)
-- =============================================================================
-- Run order:
--   1. Extensions
--   2. Helper functions (updated_at trigger)
--   3. Core user tables
--   4. Cleaner & client profile tables
--   5. Availability tables
--   6. Booking tables
--   7. Payment tables
--   8. Reviews, disputes, messaging
--   9. Admin / ops tables
--  10. Indexes
--  11. Row Level Security (RLS) policies
-- =============================================================================


-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================

-- btree_gist enables exclusion constraints on non-geometric types (UUIDs, ranges)
-- Required for the no-overlap constraint on bookings
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- pgcrypto provides gen_random_uuid() on older Postgres versions
-- On PG 13+ gen_random_uuid() is built-in, but harmless to include
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- 2. HELPER: auto-update updated_at on any table
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- 3. USERS
-- =============================================================================
-- Supabase manages auth in the `auth.users` table (email, hashed password, etc.)
-- We mirror every auth user here in `public.users` to store app-level data.
-- This table is created by a Supabase trigger (see bottom of file) or
-- populated explicitly after sign-up from the backend.
-- =============================================================================

CREATE TABLE public.users (
    id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT        NOT NULL UNIQUE,
    name            TEXT        NOT NULL,
    phone           TEXT,
    role            TEXT        NOT NULL CHECK (role IN ('client', 'cleaner', 'admin')),
    avatar_url      TEXT,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Soft delete: we never hard-delete users due to booking/payment history
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 4a. CLEANER PROFILES
-- =============================================================================
-- One-to-one with users where role = 'cleaner'.
-- Stores business profile, Stripe Connect details, and approval state.
-- =============================================================================

CREATE TABLE public.cleaners (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

    -- Profile
    bio                         TEXT,
    years_experience            INTEGER     NOT NULL DEFAULT 0 CHECK (years_experience >= 0),
    hourly_rate                 NUMERIC(10,2) NOT NULL CHECK (hourly_rate >= 15.00),

    -- Admin approval workflow
    -- pending   → cleaner submitted profile, awaiting admin review
    -- approved  → admin approved, can receive bookings
    -- rejected  → admin rejected (rejection_reason populated)
    -- suspended → suspended due to strikes or policy violations
    status                      TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    rejection_reason            TEXT,
    approved_at                 TIMESTAMPTZ,
    approved_by                 UUID        REFERENCES public.users(id),

    -- Onboarding checklist flags (all must be TRUE before admin approval)
    profile_complete            BOOLEAN     NOT NULL DEFAULT FALSE,
    identity_verified           BOOLEAN     NOT NULL DEFAULT FALSE,
    stripe_onboarding_complete  BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Stripe Connect (Express account)
    stripe_account_id           TEXT        UNIQUE, -- acct_xxx

    -- Aggregate stats (updated via trigger on reviews table)
    total_jobs                  INTEGER     NOT NULL DEFAULT 0,
    average_rating              NUMERIC(3,2)         DEFAULT NULL
                                    CHECK (average_rating IS NULL OR average_rating BETWEEN 1.00 AND 5.00),

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_cleaners_updated_at
  BEFORE UPDATE ON public.cleaners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 4b. CLIENT PROFILES
-- =============================================================================
-- One-to-one with users where role = 'client'.
-- Stores Stripe customer ID and default address.
-- =============================================================================

CREATE TABLE public.clients (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

    -- Stripe customer (for saved payment methods)
    stripe_customer_id  TEXT        UNIQUE, -- cus_xxx

    -- Default address (optional — client can override per booking)
    default_address     TEXT,
    default_city        TEXT,
    default_postcode    TEXT,
    default_country     TEXT        NOT NULL DEFAULT 'IE',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 4c. SERVICE AREAS
-- =============================================================================
-- Areas a cleaner is willing to work in.
-- A cleaner can have multiple service areas (e.g., Dublin 1, Dublin 2).
-- =============================================================================

CREATE TABLE public.service_areas (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id      UUID    NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
    city            TEXT    NOT NULL,
    -- Postcode prefix for radius matching (e.g. "D01", "SW1")
    postcode_prefix TEXT,
    -- Optional radius in km for geo-based matching (future: PostGIS)
    radius_km       NUMERIC(5,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- 5. AVAILABILITY
-- =============================================================================


-- 5a. WEEKLY SCHEDULE
-- -------------------------------------------------------
-- Recurring weekly availability defined by the cleaner.
-- One row per working day. day_of_week follows ISO 8601:
--   1 = Monday … 7 = Sunday
-- -------------------------------------------------------

CREATE TABLE public.availability_schedules (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id      UUID    NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
    day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time      TIME    NOT NULL,
    end_time        TIME    NOT NULL,
    -- Buffer in minutes between consecutive jobs (e.g. travel + reset time)
    buffer_minutes  INTEGER NOT NULL DEFAULT 30 CHECK (buffer_minutes >= 0),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_schedule_times CHECK (end_time > start_time),
    -- Only one schedule entry per cleaner per day
    UNIQUE (cleaner_id, day_of_week)
);

CREATE TRIGGER trg_avail_schedule_updated_at
  BEFORE UPDATE ON public.availability_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 6. BOOKINGS
-- =============================================================================
-- Central table of the entire platform. Every job lives here.
--
-- STATE MACHINE:
--
--   pending ──► accepted ──► confirmed ──► in_progress ──► completed
--      │            │             │                              │
--      └──► expired └──► cancelled└──► cancelled          ──► disputed
--
-- pending    : Client submitted request; awaiting cleaner acceptance
-- accepted   : Cleaner accepted; client must pay within X minutes
-- confirmed  : Stripe PaymentIntent authorized; booking is locked
-- in_progress: Cleaner checked in / job started
-- completed  : Job finished; payment will be captured after 24h buffer
-- cancelled  : Cancelled by client or cleaner
-- expired    : Cleaner didn't accept in time, or client didn't pay in time
-- disputed   : Either party raised a dispute after completion
-- =============================================================================

CREATE TABLE public.bookings (
    id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id               UUID    NOT NULL REFERENCES public.clients(id),
    cleaner_id              UUID    NOT NULL REFERENCES public.cleaners(id),

    -- Status
    status                  TEXT    NOT NULL DEFAULT 'pending'
                                CHECK (status IN (
                                    'pending',
                                    'accepted',
                                    'confirmed',
                                    'in_progress',
                                    'completed',
                                    'cancelled',
                                    'expired',
                                    'disputed'
                                )),

    -- Service details
    service_type            TEXT    NOT NULL
                                CHECK (service_type IN (
                                    'standard',
                                    'deep_clean',
                                    'end_of_tenancy',
                                    'move_in'
                                )),
    special_instructions    TEXT,

    -- Location (captured at booking time, not pulled from profile)
    address                 TEXT    NOT NULL,
    city                    TEXT    NOT NULL,
    postcode                TEXT    NOT NULL,
    country                 TEXT    NOT NULL DEFAULT 'IE',

    -- Scheduling (stored in UTC)
    scheduled_start         TIMESTAMPTZ NOT NULL,
    scheduled_end           TIMESTAMPTZ NOT NULL,
    duration_hours          NUMERIC(4,2) NOT NULL CHECK (duration_hours >= 1.0),

    -- Pricing snapshot (rates locked at booking time, not subject to cleaner changes)
    hourly_rate             NUMERIC(10,2) NOT NULL,
    subtotal                NUMERIC(10,2) NOT NULL,        -- duration_hours * hourly_rate
    platform_fee_pct        NUMERIC(5,2)  NOT NULL DEFAULT 15.00, -- e.g. 15.00 = 15%
    platform_fee            NUMERIC(10,2) NOT NULL,        -- subtotal * platform_fee_pct / 100
    cleaner_payout          NUMERIC(10,2) NOT NULL,        -- subtotal - platform_fee
    total_amount            NUMERIC(10,2) NOT NULL,        -- what client pays (= subtotal for now)

    -- Cancellation metadata
    cancellation_reason     TEXT,
    cancelled_by            UUID    REFERENCES public.users(id),
    cancelled_at            TIMESTAMPTZ,

    -- Lifecycle timestamps
    accepted_at             TIMESTAMPTZ,
    confirmed_at            TIMESTAMPTZ,
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    -- Deadline by which cleaner must accept before booking expires
    accept_by               TIMESTAMPTZ,
    -- Deadline by which client must pay after acceptance
    pay_by                  TIMESTAMPTZ,

    -- Google Calendar integration
    client_gcal_event_id    TEXT,
    cleaner_gcal_event_id   TEXT,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_booking_times    CHECK (scheduled_end > scheduled_start),
    CONSTRAINT chk_pricing_positive CHECK (
        subtotal > 0 AND platform_fee >= 0 AND cleaner_payout > 0 AND total_amount > 0
    )
);

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -------------------------------------------------------
-- CRITICAL: Prevent double-booking
-- Uses btree_gist exclusion constraint to detect
-- overlapping time ranges for the same cleaner.
-- Only active bookings (not cancelled/expired) are checked.
-- -------------------------------------------------------
ALTER TABLE public.bookings
  ADD CONSTRAINT no_overlapping_bookings
  EXCLUDE USING gist (
      cleaner_id WITH =,
      tstzrange(scheduled_start, scheduled_end, '[)') WITH &&
  )
  WHERE (status NOT IN ('cancelled', 'expired'));


-- -------------------------------------------------------
-- 6b. BLOCKED TIMES
-- -------------------------------------------------------
-- Manual date/time blocks created by the cleaner
-- (holidays, personal time, etc.)
-- Must be defined after bookings because booking_id references public.bookings.
-- -------------------------------------------------------

CREATE TABLE public.blocked_times (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id      UUID    NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
    start_datetime  TIMESTAMPTZ NOT NULL,
    end_datetime    TIMESTAMPTZ NOT NULL,
    reason          TEXT,
    -- Linked to a booking if this block was auto-created for a confirmed job
    booking_id      UUID    REFERENCES public.bookings(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_blocked_times_order CHECK (end_datetime > start_datetime)
);


-- =============================================================================
-- 7. PAYMENTS
-- =============================================================================
-- One payment record per booking.
-- Tracks the full lifecycle: authorized → captured → transferred → refunded.
-- Never store raw card data — Stripe handles that.
-- =============================================================================

CREATE TABLE public.payments (
    id                          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id                  UUID    NOT NULL UNIQUE REFERENCES public.bookings(id),

    -- Stripe identifiers
    stripe_payment_intent_id    TEXT    NOT NULL UNIQUE,  -- pi_xxx
    stripe_charge_id            TEXT    UNIQUE,           -- ch_xxx (set after capture)
    stripe_transfer_id          TEXT    UNIQUE,           -- tr_xxx (set after payout)
    stripe_refund_id            TEXT,                     -- re_xxx (set if refunded)

    -- Amounts (mirror booking amounts, stored here for payment audit trail)
    amount                      NUMERIC(10,2) NOT NULL,   -- total charged to client
    platform_fee                NUMERIC(10,2) NOT NULL,
    cleaner_payout              NUMERIC(10,2) NOT NULL,
    currency                    TEXT          NOT NULL DEFAULT 'eur',

    -- Status
    -- pending       : PaymentIntent created, awaiting client confirmation
    -- authorized    : Client confirmed; funds held, not yet captured
    -- captured      : Funds captured from client
    -- transferred   : Payout sent to cleaner's Stripe account
    -- refunded      : Fully refunded to client
    -- partially_refunded : Partial refund issued (disputed settlement)
    -- failed        : Payment failed or was declined
    status                      TEXT    NOT NULL DEFAULT 'pending'
                                    CHECK (status IN (
                                        'pending',
                                        'authorized',
                                        'captured',
                                        'transferred',
                                        'refunded',
                                        'partially_refunded',
                                        'failed'
                                    )),

    -- Refund details
    refund_amount               NUMERIC(10,2),
    refund_reason               TEXT,

    -- Lifecycle timestamps
    authorized_at               TIMESTAMPTZ,
    captured_at                 TIMESTAMPTZ,
    transferred_at              TIMESTAMPTZ,
    -- When the payout to cleaner is scheduled (24h after completion)
    payout_scheduled_at         TIMESTAMPTZ,
    refunded_at                 TIMESTAMPTZ,
    failed_at                   TIMESTAMPTZ,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 8. REVIEWS
-- =============================================================================
-- Client reviews the cleaner after job completion.
-- Enforced at application layer: only one review per booking,
-- only after status = 'completed'.
-- =============================================================================

CREATE TABLE public.reviews (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Unique: one review per booking
    booking_id  UUID    NOT NULL UNIQUE REFERENCES public.bookings(id),
    cleaner_id  UUID    NOT NULL REFERENCES public.cleaners(id),
    client_id   UUID    NOT NULL REFERENCES public.clients(id),
    rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    is_public   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -------------------------------------------------------
-- Auto-update cleaner's aggregate rating after each review
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION update_cleaner_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.cleaners
  SET
    average_rating = (
      SELECT ROUND(AVG(rating)::NUMERIC, 2)
      FROM public.reviews
      WHERE cleaner_id = NEW.cleaner_id
        AND is_public = TRUE
    ),
    total_jobs = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE cleaner_id = NEW.cleaner_id
    )
  WHERE id = NEW.cleaner_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_cleaner_rating
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_cleaner_rating();


-- =============================================================================
-- 9. DISPUTES
-- =============================================================================
-- Either party can raise a dispute after a booking is completed or in-progress.
-- Admin resolves disputes by choosing a resolution_type.
-- =============================================================================

CREATE TABLE public.disputes (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id      UUID    NOT NULL REFERENCES public.bookings(id),
    -- Who raised the dispute
    raised_by       UUID    NOT NULL REFERENCES public.users(id),
    reason          TEXT    NOT NULL,
    -- Evidence (photo URLs, message quotes, etc. — stored as JSON array of strings)
    evidence        JSONB,

    -- Status
    -- open          : Just raised
    -- under_review  : Admin is investigating
    -- resolved      : Admin has made a decision
    -- closed        : Dispute closed (after resolution implemented)
    status          TEXT    NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),

    -- Resolution
    -- full_refund       : Full refund to client, cleaner gets nothing
    -- partial_refund    : Split — refund_amount returned to client, rest to cleaner
    -- no_refund         : Payment released to cleaner in full
    -- payment_released  : Dispute withdrawn, payment proceeds normally
    resolution_type TEXT    CHECK (resolution_type IN (
                                'full_refund',
                                'partial_refund',
                                'no_refund',
                                'payment_released'
                            )),
    resolution_note TEXT,
    refund_amount   NUMERIC(10,2),

    resolved_by     UUID    REFERENCES public.users(id),
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 10. CLEANER STRIKES
-- =============================================================================
-- Issued when a cleaner cancels late, no-shows, or violates policy.
-- 3 strikes → automatic suspension (enforced at application layer).
-- =============================================================================

CREATE TABLE public.cleaner_strikes (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id  UUID    NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
    booking_id  UUID    REFERENCES public.bookings(id) ON DELETE SET NULL,
    -- Type of violation for reporting purposes
    strike_type TEXT    NOT NULL
                    CHECK (strike_type IN (
                        'late_cancellation',
                        'no_show',
                        'policy_violation',
                        'client_complaint'
                    )),
    reason      TEXT    NOT NULL,
    -- Admin who issued the strike (NULL = system-issued)
    issued_by   UUID    REFERENCES public.users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- 11. MESSAGES (In-app chat)
-- =============================================================================
-- Chat is only enabled after booking status = 'confirmed'.
-- Enforced at application layer (not DB level to keep schema simple).
-- =============================================================================

CREATE TABLE public.messages (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id  UUID    NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    sender_id   UUID    NOT NULL REFERENCES public.users(id),
    content     TEXT    NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- No updated_at: messages are immutable once sent
);


-- =============================================================================
-- 12. NOTIFICATIONS
-- =============================================================================
-- In-app notification records. Email/push delivery handled externally (Resend etc.)
-- =============================================================================

CREATE TABLE public.notifications (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- Type maps to notification templates in frontend
    -- e.g. 'booking_accepted', 'payment_captured', 'dispute_opened'
    type        TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    body        TEXT    NOT NULL,
    -- Extra context for deep-linking (e.g. {"booking_id": "abc-123"})
    data        JSONB,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- 13. GOOGLE CALENDAR TOKENS
-- =============================================================================
-- Stores OAuth tokens for users who connected Google Calendar.
-- Tokens are encrypted at rest (use Supabase Vault in production).
-- =============================================================================

CREATE TABLE public.google_calendar_tokens (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID    NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    access_token    TEXT    NOT NULL,
    refresh_token   TEXT    NOT NULL,
    token_expiry    TIMESTAMPTZ NOT NULL,
    calendar_id     TEXT    NOT NULL DEFAULT 'primary',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_gcal_tokens_updated_at
  BEFORE UPDATE ON public.google_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 14. PLATFORM CONFIG
-- =============================================================================
-- Key-value store for runtime-configurable platform settings.
-- Avoids hardcoding values like commission rates.
-- Examples:
--   platform_fee_pct     = "15.00"
--   payout_delay_hours   = "24"
--   booking_accept_ttl   = "60"   (minutes cleaner has to accept)
--   booking_pay_ttl      = "15"   (minutes client has to pay after acceptance)
-- =============================================================================

CREATE TABLE public.platform_config (
    key         TEXT    PRIMARY KEY,
    value       TEXT    NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_config (key, value, description) VALUES
    ('platform_fee_pct',    '15.00', 'Platform commission percentage taken from each booking'),
    ('payout_delay_hours',  '24',    'Hours after job completion before cleaner payout is released'),
    ('booking_accept_ttl',  '60',    'Minutes a cleaner has to accept a booking request before it expires'),
    ('booking_pay_ttl',     '15',    'Minutes a client has to complete payment after cleaner accepts'),
    ('min_hourly_rate',     '15.00', 'Minimum hourly rate a cleaner can set (EUR)'),
    ('min_booking_hours',   '1.0',   'Minimum job duration in hours');


-- =============================================================================
-- 15. INDEXES
-- =============================================================================
-- All foreign keys get indexes. Additional indexes on high-query columns.
-- =============================================================================

-- users
CREATE INDEX idx_users_email         ON public.users(email);
CREATE INDEX idx_users_role          ON public.users(role);
CREATE INDEX idx_users_deleted_at    ON public.users(deleted_at) WHERE deleted_at IS NULL;

-- cleaners
CREATE INDEX idx_cleaners_user_id    ON public.cleaners(user_id);
CREATE INDEX idx_cleaners_status     ON public.cleaners(status);
CREATE INDEX idx_cleaners_rating     ON public.cleaners(average_rating DESC NULLS LAST);

-- clients
CREATE INDEX idx_clients_user_id     ON public.clients(user_id);

-- service_areas
CREATE INDEX idx_service_areas_cleaner ON public.service_areas(cleaner_id);
CREATE INDEX idx_service_areas_city    ON public.service_areas(city);

-- availability_schedules
CREATE INDEX idx_avail_cleaner_day   ON public.availability_schedules(cleaner_id, day_of_week);

-- blocked_times
CREATE INDEX idx_blocked_cleaner     ON public.blocked_times(cleaner_id);
CREATE INDEX idx_blocked_range       ON public.blocked_times USING gist (
    cleaner_id,
    tstzrange(start_datetime, end_datetime)
);

-- bookings
CREATE INDEX idx_bookings_client     ON public.bookings(client_id);
CREATE INDEX idx_bookings_cleaner    ON public.bookings(cleaner_id);
CREATE INDEX idx_bookings_status     ON public.bookings(status);
CREATE INDEX idx_bookings_start      ON public.bookings(scheduled_start);
CREATE INDEX idx_bookings_cleaner_start ON public.bookings(cleaner_id, scheduled_start);
-- Partial index: only active bookings (most queries filter out cancelled/expired)
CREATE INDEX idx_bookings_active     ON public.bookings(cleaner_id, scheduled_start)
    WHERE status NOT IN ('cancelled', 'expired');

-- payments
CREATE INDEX idx_payments_booking    ON public.payments(booking_id);
CREATE INDEX idx_payments_pi         ON public.payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status     ON public.payments(status);
CREATE INDEX idx_payments_payout_scheduled ON public.payments(payout_scheduled_at)
    WHERE status = 'captured';

-- reviews
CREATE INDEX idx_reviews_cleaner     ON public.reviews(cleaner_id);
CREATE INDEX idx_reviews_client      ON public.reviews(client_id);

-- disputes
CREATE INDEX idx_disputes_booking    ON public.disputes(booking_id);
CREATE INDEX idx_disputes_status     ON public.disputes(status);
CREATE INDEX idx_disputes_raised_by  ON public.disputes(raised_by);

-- cleaner_strikes
CREATE INDEX idx_strikes_cleaner     ON public.cleaner_strikes(cleaner_id);

-- messages
CREATE INDEX idx_messages_booking    ON public.messages(booking_id);
CREATE INDEX idx_messages_sender     ON public.messages(sender_id);
CREATE INDEX idx_messages_unread     ON public.messages(booking_id, is_read)
    WHERE is_read = FALSE;

-- notifications
CREATE INDEX idx_notifs_user         ON public.notifications(user_id);
CREATE INDEX idx_notifs_unread       ON public.notifications(user_id, is_read)
    WHERE is_read = FALSE;


-- =============================================================================
-- 16. ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- Supabase enforces RLS when clients connect via the anon/service_role keys.
-- Backend service (using service_role key) bypasses RLS — enforce access
-- control in the FastAPI layer instead.
-- These policies protect direct DB access from the frontend if needed.
-- =============================================================================

ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaners               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_areas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_times          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_strikes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- users: each user sees only their own row
-- -------------------------------------------------------
CREATE POLICY users_select_own ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY users_update_own ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- -------------------------------------------------------
-- cleaners: own profile full access; others read-only if approved
-- -------------------------------------------------------
CREATE POLICY cleaners_select_own ON public.cleaners
    FOR SELECT USING (
        user_id = auth.uid()
        OR status = 'approved'   -- public profile visible to clients
    );

CREATE POLICY cleaners_update_own ON public.cleaners
    FOR UPDATE USING (user_id = auth.uid());

-- -------------------------------------------------------
-- clients: own profile only
-- -------------------------------------------------------
CREATE POLICY clients_select_own ON public.clients
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY clients_update_own ON public.clients
    FOR UPDATE USING (user_id = auth.uid());

-- -------------------------------------------------------
-- bookings: visible to the client or cleaner on that booking
-- -------------------------------------------------------
CREATE POLICY bookings_select_parties ON public.bookings
    FOR SELECT USING (
        client_id  IN (SELECT id FROM public.clients  WHERE user_id = auth.uid())
        OR
        cleaner_id IN (SELECT id FROM public.cleaners WHERE user_id = auth.uid())
    );

-- -------------------------------------------------------
-- payments: visible only to the client on that booking
-- (cleaners see payout info via the booking row, not payment details)
-- -------------------------------------------------------
CREATE POLICY payments_select_client ON public.payments
    FOR SELECT USING (
        booking_id IN (
            SELECT b.id FROM public.bookings b
            JOIN public.clients c ON c.id = b.client_id
            WHERE c.user_id = auth.uid()
        )
    );

-- -------------------------------------------------------
-- messages: visible to both parties on the booking
-- -------------------------------------------------------
CREATE POLICY messages_select_parties ON public.messages
    FOR SELECT USING (
        booking_id IN (
            SELECT id FROM public.bookings
            WHERE
                client_id  IN (SELECT id FROM public.clients  WHERE user_id = auth.uid())
                OR
                cleaner_id IN (SELECT id FROM public.cleaners WHERE user_id = auth.uid())
        )
    );

CREATE POLICY messages_insert_parties ON public.messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND booking_id IN (
            SELECT id FROM public.bookings
            WHERE
                client_id  IN (SELECT id FROM public.clients  WHERE user_id = auth.uid())
                OR
                cleaner_id IN (SELECT id FROM public.cleaners WHERE user_id = auth.uid())
        )
    );

-- -------------------------------------------------------
-- notifications: own only
-- -------------------------------------------------------
CREATE POLICY notifications_own ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

-- -------------------------------------------------------
-- reviews: public read; insert only by review author
-- -------------------------------------------------------
CREATE POLICY reviews_select_public ON public.reviews
    FOR SELECT USING (is_public = TRUE);

CREATE POLICY reviews_select_own ON public.reviews
    FOR SELECT USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

-- -------------------------------------------------------
-- google_calendar_tokens: own only (sensitive)
-- -------------------------------------------------------
CREATE POLICY gcal_tokens_own ON public.google_calendar_tokens
    FOR ALL USING (user_id = auth.uid());


-- =============================================================================
-- 17. SUPABASE AUTH HOOK
-- =============================================================================
-- Automatically inserts a row into public.users when a new auth user signs up.
-- Called via Supabase's "Database Webhooks" or a Postgres trigger on auth.users.
--
-- NOTE: You must enable this trigger in Supabase Dashboard under
-- Authentication → Hooks, OR add it manually as shown below.
-- The `role` will be set to 'client' by default; onboarding flow
-- updates it to 'cleaner' if the user selects that path.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
