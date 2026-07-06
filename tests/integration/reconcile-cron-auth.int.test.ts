import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const reconcileState = vi.hoisted(() => ({
  expiry: { expired_unpaid_drafts: 0, expired_pending: 0, cancelled_pending_intents: 0 },
  autoStarts: { checked: 0, started: 0, failed: 0, errors: [] as string[] },
  autoCompletions: { checked: 0, completed: 0, failed: 0, errors: [] as string[] },
  captures: { checked: 0, captured: 0, failed: 0, errors: [] as string[] },
  releases: { checked: 0, released: 0, failed: 0, errors: [] as string[] },
  cancellationTransfers: { checked: 0, reconciled: 0, missing_transfer: 0, invalid_transfer: 0, skipped_concurrent: 0, failed: 0, errors: [] as string[] },
  reliability: { checked: 0, recalculated: 0, failed: 0, errors: [] as string[] },
}))

vi.mock('@/server/services/cleaner-reliability.service', () => ({
  cleanerReliabilityService: {
    reconcileDue: vi.fn(async () => reconcileState.reliability),
    reconcileCancellationEvents: vi.fn(async () => reconcileState.reliability),
    reconcileMissing: vi.fn(async () => reconcileState.reliability),
    reconcileAll: vi.fn(async () => reconcileState.reliability),
  },
}))

vi.mock('@/server/services/payment-lifecycle.service', () => ({
  paymentLifecycleService: {
    expireBookingDeadlines: vi.fn(async () => reconcileState.expiry),
    processAutoStarts: vi.fn(async () => reconcileState.autoStarts),
    processAutoCompletions: vi.fn(async () => reconcileState.autoCompletions),
    processDueCaptures: vi.fn(async () => reconcileState.captures),
    processDueReleaseTransitions: vi.fn(async () => reconcileState.releases),
    reconcileCancelledPaymentTransfers: vi.fn(async () => reconcileState.cancellationTransfers),
  },
}))

vi.mock('@/server/db', () => ({
  db: {
    platformConfig: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({})),
    },
  },
}))

describe('Reconcile cron auth integration', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.JOBS_SECRET = 'jobs_test_secret'
    process.env.CRON_SECRET = 'cron_test_secret'
  })

  it('accepts valid cron secret and returns reconcile summary', async () => {
    const route = await import('@/app/api/v1/jobs/reconcile/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/jobs/reconcile', {
        method: 'POST',
        headers: { authorization: 'Bearer cron_test_secret' },
      }),
    )

    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty('expiry')
    expect(body.data).toHaveProperty('cancellation_transfers')
    expect(body.data).toHaveProperty('reliability')
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })

  it('supports authenticated Vercel Cron GET requests', async () => {
    const route = await import('@/app/api/v1/jobs/reconcile/route')
    const res = await route.GET(
      new NextRequest('http://localhost/api/v1/jobs/reconcile', {
        method: 'GET',
        headers: {
          authorization: 'Bearer cron_test_secret',
          'user-agent': 'vercel-cron/1.0',
        },
      }),
    )
    expect(res.status).toBe(200)
  })

  it('rejects invalid secret with 401', async () => {
    const route = await import('@/app/api/v1/jobs/reconcile/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/jobs/reconcile', {
        method: 'POST',
        headers: { 'x-jobs-secret': 'wrong_secret' },
      }),
    )

    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
  })

  it('returns 500 when no cron secrets are configured', async () => {
    process.env.JOBS_SECRET = ''
    process.env.CRON_SECRET = ''
    const route = await import('@/app/api/v1/jobs/reconcile/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/jobs/reconcile', {
        method: 'POST',
      }),
    )

    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
    expect(String(body.message)).toContain('not configured')
  })
})
