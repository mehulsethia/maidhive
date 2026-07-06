ALTER TABLE "public"."bookings"
ADD COLUMN "service_latitude" DECIMAL(9,6),
ADD COLUMN "service_longitude" DECIMAL(9,6),
ADD COLUMN "geocoding_provider" TEXT,
ADD COLUMN "geocoded_at" TIMESTAMPTZ(6),
ADD COLUMN "geocoding_status" TEXT;

ALTER TABLE "public"."disputes"
ADD COLUMN "no_show_finding" TEXT;

ALTER TABLE "public"."cleaner_strikes"
ADD COLUMN "incident_id" UUID,
ADD COLUMN "expires_at" TIMESTAMPTZ(6);

CREATE TABLE "public"."cleaner_reliability_snapshots" (
  "cleaner_id" UUID NOT NULL,
  "is_super_cleaner" BOOLEAN NOT NULL DEFAULT false,
  "completed_released_count" INTEGER NOT NULL DEFAULT 0,
  "average_rating" DECIMAL(4,2),
  "cancellation_numerator" INTEGER NOT NULL DEFAULT 0,
  "cancellation_denominator" INTEGER NOT NULL DEFAULT 0,
  "cancellation_rate" DECIMAL(6,5),
  "last_minute_incident_count_30d" INTEGER NOT NULL DEFAULT 0,
  "no_show_count_60d" INTEGER NOT NULL DEFAULT 0,
  "verified_job_count" INTEGER NOT NULL DEFAULT 0,
  "on_time_verified_count" INTEGER NOT NULL DEFAULT 0,
  "on_time_rate" DECIMAL(6,5),
  "active_strike_count" INTEGER NOT NULL DEFAULT 0,
  "criteria" JSONB NOT NULL,
  "recovery_cancellation_started_at" TIMESTAMPTZ(6),
  "recovery_no_show_started_at" TIMESTAMPTZ(6),
  "lost_at" TIMESTAMPTZ(6),
  "loss_reason" TEXT,
  "awarded_at" TIMESTAMPTZ(6),
  "next_evaluation_at" TIMESTAMPTZ(6),
  "last_calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dirty_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cleaner_reliability_snapshots_pkey" PRIMARY KEY ("cleaner_id")
);

CREATE TABLE "public"."cleaner_reliability_incidents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cleaner_id" UUID NOT NULL,
  "booking_id" UUID,
  "incident_type" TEXT NOT NULL,
  "incident_date" TEXT NOT NULL,
  "source_key" TEXT NOT NULL,
  "booking_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "latest_at" TIMESTAMPTZ(6) NOT NULL,
  "confirmed_by" UUID,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cleaner_reliability_incidents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."cleaner_start_verifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "booking_id" UUID NOT NULL,
  "cleaner_id" UUID NOT NULL,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "accuracy_m" DECIMAL(8,2),
  "distance_m" DECIMAL(10,2),
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "on_time" BOOLEAN NOT NULL DEFAULT false,
  "failure_reason" TEXT,
  "started_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cleaner_start_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."cleaner_cancellation_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cleaner_id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "incident_id" UUID,
  "cancelled_by_user_id" UUID NOT NULL,
  "cancellation_window" TEXT NOT NULL,
  "accepted_booking" BOOLEAN NOT NULL DEFAULT false,
  "is_last_minute" BOOLEAN NOT NULL DEFAULT false,
  "scheduled_start" TIMESTAMPTZ(6) NOT NULL,
  "cancelled_at" TIMESTAMPTZ(6) NOT NULL,
  "hours_before_start" DECIMAL(9,3) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cleaner_cancellation_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cleaner_strikes_incident_id_key" ON "public"."cleaner_strikes"("incident_id");
CREATE INDEX "cleaner_strikes_cleaner_id_expires_at_idx" ON "public"."cleaner_strikes"("cleaner_id", "expires_at");
CREATE INDEX "cleaner_reliability_snapshots_is_super_cleaner_idx" ON "public"."cleaner_reliability_snapshots"("is_super_cleaner");
CREATE INDEX "cleaner_reliability_snapshots_next_evaluation_at_idx" ON "public"."cleaner_reliability_snapshots"("next_evaluation_at");
CREATE INDEX "cleaner_reliability_snapshots_dirty_at_idx" ON "public"."cleaner_reliability_snapshots"("dirty_at");
CREATE UNIQUE INDEX "cleaner_reliability_incidents_cleaner_type_source_key" ON "public"."cleaner_reliability_incidents"("cleaner_id", "incident_type", "source_key");
CREATE INDEX "cleaner_reliability_incidents_cleaner_type_occurred_idx" ON "public"."cleaner_reliability_incidents"("cleaner_id", "incident_type", "occurred_at");
CREATE UNIQUE INDEX "cleaner_start_verifications_booking_id_key" ON "public"."cleaner_start_verifications"("booking_id");
CREATE INDEX "cleaner_start_verifications_cleaner_verified_started_idx" ON "public"."cleaner_start_verifications"("cleaner_id", "verified", "started_at");
CREATE UNIQUE INDEX "cleaner_cancellation_events_booking_id_key" ON "public"."cleaner_cancellation_events"("booking_id");
CREATE INDEX "cleaner_cancellation_events_cleaner_window_cancelled_idx" ON "public"."cleaner_cancellation_events"("cleaner_id", "cancellation_window", "cancelled_at");
CREATE INDEX "cleaner_cancellation_events_cleaner_last_minute_cancelled_idx" ON "public"."cleaner_cancellation_events"("cleaner_id", "is_last_minute", "cancelled_at");
CREATE INDEX "cleaner_cancellation_events_incident_id_idx" ON "public"."cleaner_cancellation_events"("incident_id");

ALTER TABLE "public"."cleaner_reliability_snapshots"
ADD CONSTRAINT "cleaner_reliability_snapshots_cleaner_id_fkey"
FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."cleaner_reliability_incidents"
ADD CONSTRAINT "cleaner_reliability_incidents_cleaner_id_fkey"
FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."cleaner_reliability_incidents"
ADD CONSTRAINT "cleaner_reliability_incidents_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."cleaner_start_verifications"
ADD CONSTRAINT "cleaner_start_verifications_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."cleaner_start_verifications"
ADD CONSTRAINT "cleaner_start_verifications_cleaner_id_fkey"
FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."cleaner_cancellation_events"
ADD CONSTRAINT "cleaner_cancellation_events_cleaner_id_fkey"
FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."cleaner_cancellation_events"
ADD CONSTRAINT "cleaner_cancellation_events_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."cleaner_cancellation_events"
ADD CONSTRAINT "cleaner_cancellation_events_incident_id_fkey"
FOREIGN KEY ("incident_id") REFERENCES "public"."cleaner_reliability_incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."cleaner_strikes"
ADD CONSTRAINT "cleaner_strikes_incident_id_fkey"
FOREIGN KEY ("incident_id") REFERENCES "public"."cleaner_reliability_incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "public"."platform_config" ("key", "value", "description", "updated_at")
VALUES (
  'super_cleaner.public_enabled',
  'false',
  'Controls public Super Cleaner badges, metrics, and search priority.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
