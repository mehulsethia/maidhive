ALTER TABLE "public"."cleaner_strikes"
DROP CONSTRAINT IF EXISTS "cleaner_strikes_strike_type_check";

ALTER TABLE "public"."cleaner_strikes"
ADD CONSTRAINT "cleaner_strikes_strike_type_check"
CHECK (
  "strike_type" IN (
    'late_cancellation',
    'no_show',
    'policy_violation',
    'client_complaint',
    'reliability_last_minute_cancellation',
    'reliability_no_show'
  )
);
