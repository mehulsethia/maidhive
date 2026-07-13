ALTER TABLE "public"."reviews"
ADD COLUMN IF NOT EXISTS "hidden_by_dispute" BOOLEAN NOT NULL DEFAULT false;
