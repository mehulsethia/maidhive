import { NextRequest } from 'next/server'
import { ok, err } from '@/server/response'
import { config } from '@/server/config'
import { paymentLifecycleService } from '@/server/services/payment-lifecycle.service'
import { db } from '@/server/db'
import { timingSafeEqual } from 'crypto'
import { cleanerReliabilityService } from '@/server/services/cleaner-reliability.service'

export const runtime = 'nodejs'
export const maxDuration = 60

const CRON_INTERVAL_MS = 5 * 60 * 1000
const MISSED_RUN_ALERT_MS = CRON_INTERVAL_MS * 2
const BATCH_LIMIT = 200
const MAX_BATCH_PASSES = 3

type ReconcileSummary = {
  expiry: Record<string, unknown>
  captures: Record<string, unknown>
  releases: Record<string, unknown>
  cancellation_transfers: Record<string, unknown>
  auto_starts: Record<string, unknown>
  auto_completions: Record<string, unknown>
  reliability: Record<string, unknown>
}

export const GET = handleReconcile
export const POST = handleReconcile

async function handleReconcile(req: NextRequest) {
  const startedAt = Date.now()
  const runId = `reconcile_${crypto.randomUUID()}`
  const userAgent = req.headers.get('user-agent')?.toLowerCase() ?? ''
  const source = userAgent.includes('vercel cron') || userAgent.includes('vercel-cron')
    ? 'vercel_cron'
    : 'manual_or_api'

  const expectedSecrets = [config.JOBS_SECRET, config.CRON_SECRET].filter(Boolean)
  if (expectedSecrets.length === 0) {
    console.error('reconcile.auth.misconfigured', { runId, source })
    return err('JOBS_SECRET or CRON_SECRET is not configured', 500)
  }

  const provided =
    req.headers.get('x-jobs-secret') ??
    extractBearerToken(req.headers.get('authorization'))
  const authorized = Boolean(
    provided && expectedSecrets.some((secret) => safeSecretEqual(provided, secret)),
  )

  if (!authorized) {
    console.warn('reconcile.auth.unauthorized', {
      runId,
      source,
      hasBearer: Boolean(extractBearerToken(req.headers.get('authorization'))),
      hasJobsHeader: Boolean(req.headers.get('x-jobs-secret')),
    })
    return err('Unauthorized', 401)
  }

  const previousRunAt = await readPlatformConfigDate('reconcile.last_run_at')
  if (previousRunAt && startedAt - previousRunAt.getTime() > MISSED_RUN_ALERT_MS) {
    console.error('reconcile.alert.missed_window', {
      runId,
      source,
      gap_ms: startedAt - previousRunAt.getTime(),
      threshold_ms: MISSED_RUN_ALERT_MS,
      previous_run_at: previousRunAt.toISOString(),
    })
  }

  try {
    // Run in lifecycle order so downstream stages consume the latest booking state in the same pass.
    const expirySummary = await paymentLifecycleService.expireBookingDeadlines()
    const autoStartSummary = await runBatched((limit) => paymentLifecycleService.processAutoStarts(limit))
    const autoCompletionSummary = await runBatched((limit) => paymentLifecycleService.processAutoCompletions(limit))
    const captureSummary = await runBatched((limit) => paymentLifecycleService.processDueCaptures(limit))
    const releaseSummary = await runBatched((limit) => paymentLifecycleService.processDueReleaseTransitions(limit))
    const cancellationTransferSummary = await paymentLifecycleService.reconcileCancelledPaymentTransfers(BATCH_LIMIT)
    const reliabilityDueSummary = await runReliabilityStep(
      () => cleanerReliabilityService.reconcileDue(BATCH_LIMIT),
      'due',
    )
    const reliabilityCancellationSummary = await runReliabilityStep(
      () => cleanerReliabilityService.reconcileCancellationEvents(BATCH_LIMIT),
      'cancellation_events',
    )
    const reliabilityMissingSummary = await runReliabilityStep(
      () => cleanerReliabilityService.reconcileMissing(BATCH_LIMIT),
      'missing',
    )
    const previousReliabilityAuditAt =
      await readPlatformConfigDate('super_cleaner.last_full_audit_at')
    const shouldRunReliabilityAudit =
      !previousReliabilityAuditAt ||
      Date.now() - previousReliabilityAuditAt.getTime() >= 24 * 60 * 60 * 1000
    const reliabilityAuditSummary = shouldRunReliabilityAudit
      ? await runReliabilityStep(
          () => runBatched((limit) => cleanerReliabilityService.reconcileAll(limit)),
          'full_audit',
        )
      : { checked: 0, recalculated: 0, failed: 0, errors: [] }
    if (
      shouldRunReliabilityAudit &&
      Number(reliabilityAuditSummary.failed ?? 0) === 0
    ) {
      await setPlatformConfig(
        'super_cleaner.last_full_audit_at',
        new Date().toISOString(),
        'Last full cleaner reliability drift audit timestamp (UTC).',
      )
    }

    const summary: ReconcileSummary = {
      expiry: expirySummary as Record<string, unknown>,
      captures: captureSummary as Record<string, unknown>,
      releases: releaseSummary as Record<string, unknown>,
      cancellation_transfers: cancellationTransferSummary as Record<string, unknown>,
      auto_starts: autoStartSummary as Record<string, unknown>,
      auto_completions: autoCompletionSummary as Record<string, unknown>,
      reliability: mergeSummary(
        mergeSummary(
          mergeSummary(
            reliabilityDueSummary as Record<string, unknown>,
            reliabilityCancellationSummary as Record<string, unknown>,
          ),
          reliabilityMissingSummary as Record<string, unknown>,
        ),
        reliabilityAuditSummary as Record<string, unknown>,
      ),
    }

    const failureCount = countSummaryFailures(summary)
    const completedAtIso = new Date().toISOString()
    await persistReconcileHeartbeat({
      startedAtIso: new Date(startedAt).toISOString(),
      completedAtIso,
      durationMs: Date.now() - startedAt,
      failureCount,
    })

    const telemetry = {
      event: 'reconcile.run.summary',
      run_id: runId,
      source,
      started_at: new Date(startedAt).toISOString(),
      completed_at: completedAtIso,
      duration_ms: Date.now() - startedAt,
      failure_count: failureCount,
      summary,
    }

    if (failureCount > 0) {
      console.error('reconcile.alert.run_failures', telemetry)
    } else {
      console.info('reconcile.run.summary', telemetry)
    }

    return ok(summary)
  } catch (error) {
    const durationMs = Date.now() - startedAt
    await persistReconcileHeartbeat({
      startedAtIso: new Date(startedAt).toISOString(),
      completedAtIso: new Date().toISOString(),
      durationMs,
      failureCount: 1,
    })
    console.error('reconcile.run.failed', {
      run_id: runId,
      source,
      duration_ms: durationMs,
      error: error instanceof Error ? error.message : String(error),
    })
    return err('Reconcile run failed', 500)
  }
}

async function runReliabilityStep(
  fn: () => Promise<Record<string, unknown>>,
  stage: string,
) {
  try {
    return await fn()
  } catch (error) {
    console.error('cleaner_reliability.reconcile_stage_failed', {
      stage,
      message: error instanceof Error ? error.message : String(error),
    })
    return {
      checked: 0,
      recalculated: 0,
      failed: 1,
      errors: [error instanceof Error ? error.message : String(error)],
    }
  }
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

async function runBatched<T extends Record<string, unknown>>(
  fn: (limit: number) => Promise<T>,
) {
  let aggregate: T | null = null
  for (let pass = 0; pass < MAX_BATCH_PASSES; pass += 1) {
    const current = await fn(BATCH_LIMIT)
    aggregate = aggregate ? mergeSummary(aggregate, current) : current
    const checked = Number(current.checked ?? 0)
    if (!Number.isFinite(checked) || checked < BATCH_LIMIT) break
  }
  return aggregate ?? ({} as T)
}

function mergeSummary<T extends Record<string, unknown>>(base: T, next: T): T {
  const merged: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === 'number') {
      merged[key] = Number(merged[key] ?? 0) + value
      continue
    }
    if (Array.isArray(value)) {
      const existing = Array.isArray(merged[key]) ? (merged[key] as unknown[]) : []
      merged[key] = [...existing, ...value]
      continue
    }
    merged[key] = value
  }
  return merged as T
}

function countSummaryFailures(summary: ReconcileSummary) {
  const sections = Object.values(summary)
  return sections.reduce((count, section) => {
    return count + Number(section.failed ?? 0)
  }, 0)
}

async function readPlatformConfigDate(key: string) {
  try {
    const row = await db.platformConfig.findUnique({ where: { key } })
    if (!row?.value) return null
    const date = new Date(row.value)
    if (Number.isNaN(date.getTime())) return null
    return date
  } catch {
    return null
  }
}

async function setPlatformConfig(key: string, value: string, description: string) {
  await db.platformConfig.upsert({
    where: { key },
    create: { key, value, description },
    update: { value, description },
  })
}

async function persistReconcileHeartbeat(args: {
  startedAtIso: string
  completedAtIso: string
  durationMs: number
  failureCount: number
}) {
  try {
    await setPlatformConfig(
      'reconcile.last_run_at',
      args.completedAtIso,
      'Last reconcile completion timestamp (UTC).',
    )
    await setPlatformConfig(
      'reconcile.last_run_duration_ms',
      String(args.durationMs),
      'Duration of last reconcile run in milliseconds.',
    )
    await setPlatformConfig(
      'reconcile.last_failure_count',
      String(args.failureCount),
      'Failed operation count observed in last reconcile run.',
    )
    await setPlatformConfig(
      'reconcile.last_started_at',
      args.startedAtIso,
      'Last reconcile start timestamp (UTC).',
    )
    if (args.failureCount === 0) {
      await setPlatformConfig(
        'reconcile.last_success_at',
        args.completedAtIso,
        'Last successful reconcile completion timestamp (UTC).',
      )
    }
  } catch (error) {
    console.error('reconcile.telemetry.persist_failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
