CREATE TABLE "public"."booking_action_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "actor_role" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_action_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "booking_action_events_booking_created_idx"
ON "public"."booking_action_events"("booking_id", "created_at");

ALTER TABLE "public"."booking_action_events"
ADD CONSTRAINT "booking_action_events_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
