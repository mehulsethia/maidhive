-- Remove legacy check constraints that can block CY/Larnaca saves
-- (older environments may still enforce IE-era rules on client_addresses).

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'client_addresses'
      AND con.contype = 'c'
      AND (
        pg_get_constraintdef(con.oid) ILIKE '%country%'
        OR pg_get_constraintdef(con.oid) ILIKE '%city%'
        OR pg_get_constraintdef(con.oid) ILIKE '%postcode%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.client_addresses DROP CONSTRAINT IF EXISTS %I', rec.conname);
  END LOOP;
END $$;

ALTER TABLE public.client_addresses
  ALTER COLUMN country SET DEFAULT 'CY';

UPDATE public.client_addresses
SET country = 'CY'
WHERE country IS NULL OR btrim(country) = '' OR upper(country) <> 'CY';

ALTER TABLE public.client_addresses
  ALTER COLUMN country SET NOT NULL;
