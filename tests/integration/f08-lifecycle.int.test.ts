import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const seededUsers = vi.hoisted(() => ({
  client: { id: '11111111-1111-1111-1111-111111111111', role: 'client' },
  cleaner: { id: '22222222-2222-2222-2222-222222222222', role: 'cleaner' },
  admin: { id: '33333333-3333-3333-3333-333333333333', role: 'admin' },
}))

const state = vi.hoisted(() => ({
  currentUser: seededUsers.cleaner as any | null,
  completeResult: {
    id: 'booking_1',
    status: 'completed',
    completedAt: new Date('2026-06-10T10:00:00.000Z').toISOString(),
    completedBy: 'cleaner',
  },
  applyActionResult: {
    id: 'booking_2',
    status: 'in_progress',
    startedAt: new Date('2026-06-10T09:00:00.000Z').toISOString(),
    startInitiatedBy: 'cleaner',
  },
  throwInvalidTransition: false,
  reconcileSummary: {
    expiry: { checked: 0, expired_unpaid_drafts: 0, expired_pending: 0, cancelled_draft_intents: 0, cancelled_pending_intents: 0 },
    auto_starts: { checked: 1, started: 1, failed: 0, errors: [] as string[] },
    auto_completions: { checked: 1, completed: 1, paused_by_dispute: 0, failed: 0, errors: [] as string[] },
    captures: { checked: 0, captured: 0, paused_by_dispute: 0, skipped_non_due: 0, failed: 0, errors: [] as string[] },
    releases: { checked: 0, released: 0, failed: 0, errors: [] as string[] },
    cancellation_transfers: { checked: 0, reconciled: 0, missing_transfer: 0, invalid_transfer: 0, skipped_concurrent: 0, failed: 0, errors: [] as string[] },
  },
}))

vi.mock('@/server/auth', () => {
  const unauthorized = () =>
    new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 })
  const forbidden = () =>
    new Response(JSON.stringify({ success: false, message: 'Forbidden' }), { status: 403 })

  return {
    requireCleaner: (handler: any) => async (req: NextRequest, ctx: any) => {
      if (!state.currentUser) return unauthorized()
      if (state.currentUser.role !== 'cleaner') return forbidden()
      return handler(req, ctx, state.currentUser)
    },
    requireAuth: (handler: any) => async (req: NextRequest, ctx: any) => {
      if (!state.currentUser) return unauthorized()
      return handler(req, ctx, state.currentUser)
    },
  }
})

vi.mock('@/server/services/booking.service', () => {
  class ServiceError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  }

  return {
    ServiceError,
    bookingService: {
      completeByCleaner: vi.fn(async () => state.completeResult),
      reconcileSingleBookingDeadline: vi.fn(async () => true),
      applyAction: vi.fn(async () => {
        if (state.throwInvalidTransition) {
          throw new ServiceError('Invalid status transition', 400)
        }
        return state.applyActionResult
      }),
    },
  }
})

vi.mock('@/server/services/booking-visibility.service', () => ({
  sanitizeBookingForRole: (booking: any) => booking,
}))

vi.mock('@/server/services/payment-lifecycle.service', () => ({
  paymentLifecycleService: {
    expireBookingDeadlines: vi.fn(async () => state.reconcileSummary.expiry),
    processAutoStarts: vi.fn(async () => state.reconcileSummary.auto_starts),
    processAutoCompletions: vi.fn(async () => state.reconcileSummary.auto_completions),
    processDueCaptures: vi.fn(async () => state.reconcileSummary.captures),
    processDueReleaseTransitions: vi.fn(async () => state.reconcileSummary.releases),
    reconcileCancelledPaymentTransfers: vi.fn(async () => state.reconcileSummary.cancellation_transfers),
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

describe('F08 Confirmed booking lifecycle integration', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.cleaner as any
    state.throwInvalidTransition = false
    process.env.JOBS_SECRET = 'jobs_test_secret'
    process.env.CRON_SECRET = ''
  })

  it('IT-LIFECYCLE-01 reconcile endpoint auto-start summary is returned', async () => {
    const route = await import('@/app/api/v1/jobs/reconcile/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/jobs/reconcile', {
        method: 'POST',
        headers: { 'x-jobs-secret': 'jobs_test_secret' },
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.auto_starts.started).toBe(1)
  })

  it('IT-LIFECYCLE-02 reconcile endpoint auto-complete summary is returned', async () => {
    const route = await import('@/app/api/v1/jobs/reconcile/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/jobs/reconcile', {
        method: 'POST',
        headers: { authorization: 'Bearer jobs_test_secret' },
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.auto_completions.completed).toBe(1)
  })

  it('IT-LIFECYCLE-03 manual cleaner start updates startedAt and startInitiatedBy', async () => {
    const route = await import('@/app/api/v1/bookings/[id]/action/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/bookings/booking_2/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'booking_2' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('in_progress')
    expect(body.data.startInitiatedBy ?? body.data.start_initiated_by).toBe('cleaner')
  })

  it('IT-LIFECYCLE-04 invalid lifecycle transition is rejected', async () => {
    state.throwInvalidTransition = true
    const route = await import('@/app/api/v1/bookings/[id]/action/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/bookings/booking_2/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'booking_2' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.message).toContain('Invalid status transition')
  })
})
