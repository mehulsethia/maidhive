import { NextRequest } from 'next/server'
import { ok, err } from '@/server/response'
import { config } from '@/server/config'
import { paymentLifecycleService } from '@/server/services/payment-lifecycle.service'
import { timingSafeEqual } from 'crypto'

// POST /api/v1/jobs/reconcile
// Intended for cron/scheduler usage.
export async function POST(req: NextRequest) {
  const expectedSecrets = [config.JOBS_SECRET, config.CRON_SECRET].filter(Boolean)
  if (expectedSecrets.length === 0) {
    return err('JOBS_SECRET or CRON_SECRET is not configured', 500)
  }

  const provided =
    req.headers.get('x-jobs-secret') ??
    extractBearerToken(req.headers.get('authorization'))
  const authorized = Boolean(
    provided && expectedSecrets.some((secret) => safeSecretEqual(provided, secret)),
  )

  if (!authorized) {
    return err('Unauthorized', 401)
  }

  // Run in lifecycle order so downstream stages consume the latest booking state in the same pass.
  const expirySummary = await paymentLifecycleService.expireBookingDeadlines()
  const autoStartSummary = await paymentLifecycleService.processAutoStarts()
  const autoCompletionSummary = await paymentLifecycleService.processAutoCompletions()
  const captureSummary = await paymentLifecycleService.processDueCaptures()
  const releaseSummary = await paymentLifecycleService.processDueReleaseTransitions()

  return ok({
    expiry: expirySummary,
    captures: captureSummary,
    releases: releaseSummary,
    auto_starts: autoStartSummary,
    auto_completions: autoCompletionSummary,
  })
}

function safeSecretEqual(a: string, b: string) {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

function extractBearerToken(value: string | null) {
  if (!value) return null
  const [scheme, token] = value.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}
