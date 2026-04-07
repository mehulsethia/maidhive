import { NextRequest } from 'next/server'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok, err } from '@/server/response'
import { cleanerSearchSchema } from '@/server/schemas/cleaner.schema'

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = cleanerSearchSchema.safeParse(params)
  if (!parsed.success) return err(parsed.error.message, 422)

  const { city, page, page_size } = parsed.data
  const [cleaners, total] = await cleanerRepo.search({ city, page, pageSize: page_size })
  return ok({ cleaners, total, page, page_size })
}
