import { NextRequest } from 'next/server'
import { ok, err } from '@/server/response'
import { config } from '@/server/config'
import { paymentLifecycleService } from '@/server/services/payment-lifecycle.service'

// POST /api/v1/jobs/reconcile
// Intended for cron/scheduler usage.
export async function POST(req: NextRequest) {
  if (!config.JOBS_SECRET) {
    return err('JOBS_SECRET is not configured', 500)
  }

  const provided = req.headers.get('x-jobs-secret')
  if (!provided || provided !== config.JOBS_SECRET) {
    return err('Unauthorized', 401)
  }

  const [expirySummary, captureSummary, autoCompletionSummary] = await Promise.all([
    paymentLifecycleService.expireBookingDeadlines(),
    paymentLifecycleService.processDueCaptures(),
    paymentLifecycleService.processAutoCompletions(),
  ])

  return ok({
    expiry: expirySummary,
    captures: captureSummary,
    auto_completions: autoCompletionSummary,
  })
}
