import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok, err } from '@/server/response'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const cleaner = await cleanerRepo.findById(id)
  if (!cleaner || cleaner.status !== 'approved') return err('Cleaner not found', 404)
  return ok(cleaner)
}
