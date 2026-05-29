import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const reconcileState = vi.hoisted(() => ({
  expiry: { expired_unpaid_drafts: 0, expired_pending: 0, cancelled_pending_intents: 0 },
  autoStarts: { checked: 0, started: 0, failed: 0, errors: [] as string[] },
  autoCompletions: { checked: 0, completed: 0, failed: 0, errors: [] as string[] },
  captures: { checked: 0, captured: 0, failed: 0, errors: [] as string[] },
  releases: { checked: 0, released: 0, failed: 0, errors: [] as string[] },
}))

vi.mock('@/server/services/payment-lifecycle.service', () => ({
  paymentLifecycleService: {
    expireBookingDeadlines: vi.fn(async () => reconcileState.expiry),
    processAutoStarts: vi.fn(async () => reconcileState.autoStarts),
    processAutoCompletions: vi.fn(async () => reconcileState.autoCompletions),
    processDueCaptures: vi.fn(async () => reconcileState.captures),
    processDueReleaseTransitions: vi.fn(async () => reconcileState.releases),
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
    expect(res.headers.get('x-request-id')).toBeTruthy()
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
