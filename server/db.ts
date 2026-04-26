import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

export const db = globalThis.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db
}

let schemaReadyPromise: Promise<void> | null = null

/**
 * Defensive compatibility guard:
 * ensures additive columns exist before query-heavy API paths run.
 * This prevents total data outages when a deploy ships code before SQL migration is applied.
 */
export function ensureDbSchema(): Promise<void> {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await db.$executeRawUnsafe(`
        ALTER TABLE public.cleaners
        ADD COLUMN IF NOT EXISTS id_file_url TEXT
      `)
      await db.$executeRawUnsafe(`
        ALTER TABLE public.cleaners
        ADD COLUMN IF NOT EXISTS cleaning_supplies TEXT,
        ADD COLUMN IF NOT EXISTS pet_comfortable BOOLEAN,
        ADD COLUMN IF NOT EXISTS work_eligibility_answer BOOLEAN,
        ADD COLUMN IF NOT EXISTS cleaning_standards_accepted BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS cleaning_quiz_score INTEGER,
        ADD COLUMN IF NOT EXISTS cleaning_quiz_passed_at TIMESTAMPTZ
      `)
      await db.$executeRawUnsafe(`
        ALTER TABLE public.bookings
        ADD COLUMN IF NOT EXISTS apartment_details TEXT,
        ADD COLUMN IF NOT EXISTS access_notes TEXT NOT NULL DEFAULT ''
      `)
      await db.$executeRawUnsafe(`
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
        )
      `)
    })().catch((error) => {
      schemaReadyPromise = null
      throw error
    })
  }
  return schemaReadyPromise
}
