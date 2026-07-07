import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const seededUsers = vi.hoisted(() => ({
  client: { id: '11111111-1111-1111-1111-111111111111', role: 'client' },
  cleaner: { id: '22222222-2222-2222-2222-222222222222', role: 'cleaner' },
}))

const state = vi.hoisted(() => ({
  currentUser: seededUsers.client as any | null,
  cancelCalls: [] as any[],
  cancelResult: {
    id: 'booking_cancel_1',
    status: 'cancelled',
    cancelReason: 'Client cannot host service anymore',
    paymentReleaseTriggered: true,
  },
  actionResult: {
    id: 'booking_action_1',
    status: 'confirmed',
    scheduledStart: '2026-06-12T11:00:00.000Z',
    proposalContext: 'post_confirmation',
  },
}))

vi.mock('@/server/auth', () => {
  const unauthorized = () =>
    new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 })
  return {
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
      cancel: vi.fn(async (_id: string, user: any, reason?: string, options?: any) => {
        state.cancelCalls.push({ id: _id, user, reason, options })
        return {
        ...state.cancelResult,
        cancelledByRole: user.role,
        cancelReason: reason ?? state.cancelResult.cancelReason,
        }
      }),
      reconcileSingleBookingDeadline: vi.fn(async () => true),
      applyAction: vi.fn(async (_id: string, user: any, payload: any) => ({
        ...state.actionResult,
        actionApplied: payload.action,
        actedByRole: user.role,
      })),
    },
  }
})

vi.mock('@/server/services/booking-visibility.service', () => ({
  sanitizeBookingForRole: (booking: any) => booking,
}))

describe('F09 Reschedule and cancel policy integration', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.client as any
    state.cancelCalls = []
    state.cancelResult = {
      id: 'booking_cancel_1',
      status: 'cancelled',
      cancelReason: 'Client cannot host service anymore',
      paymentReleaseTriggered: true,
    }
    state.actionResult = {
      id: 'booking_action_1',
      status: 'confirmed',
      scheduledStart: '2026-06-12T11:00:00.000Z',
      proposalContext: 'post_confirmation',
    }
  })

  it('IT-CANCEL-01 client cancel pending releases authorization and stores cancellation metadata', async () => {
    const route = await import('@/app/api/v1/bookings/[id]/cancel/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/bookings/booking_cancel_1/cancel', {
        method: 'POST',
        body: JSON.stringify({ reason: 'Need to cancel before acceptance' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'booking_cancel_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('cancelled')
    expect(String(body.data.cancelReason ?? body.data.cancel_reason ?? '')).toContain('Need to cancel')
  })

  it('IT-CANCEL-02 client cancel confirmed booking returns deterministic cancelled state', async () => {
    state.cancelResult = {
      ...state.cancelResult,
      id: 'booking_confirmed_1',
      status: 'cancelled',
      cancelReason: 'Client cancelled confirmed booking within policy',
    }

    const route = await import('@/app/api/v1/bookings/[id]/cancel/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/bookings/booking_confirmed_1/cancel', {
        method: 'POST',
        body: JSON.stringify({ reason: 'Client cancelled confirmed booking within policy' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'booking_confirmed_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(String(body.data.cancelReason ?? body.data.cancel_reason ?? '')).toContain('confirmed')
  })

  it('IT-CANCEL-03 cleaner cancel confirmed booking applies role-specific cancellation metadata', async () => {
    state.currentUser = seededUsers.cleaner as any
    state.cancelResult = {
      ...state.cancelResult,
      id: 'booking_cleaner_cancel_1',
      cancelReason: 'Cleaner unavailable for confirmed job',
    }

    const route = await import('@/app/api/v1/bookings/[id]/cancel/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/bookings/booking_cleaner_cancel_1/cancel', {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cleaner unavailable for confirmed job' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'booking_cleaner_cancel_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.cancelledByRole ?? body.data.cancelled_by_role).toBe('cleaner')
  })

  it('IT-CANCEL-05 cleaner can request rest-of-today cancellation from cancellation route', async () => {
    state.currentUser = seededUsers.cleaner as any
    state.cancelResult = {
      ...state.cancelResult,
      id: 'booking_cleaner_cancel_today_1',
      cancelReason: 'Cleaner unavailable today',
    }

    const route = await import('@/app/api/v1/bookings/[id]/cancel/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/bookings/booking_cleaner_cancel_today_1/cancel', {
        method: 'POST',
        body: JSON.stringify({
          reason: 'Cleaner unavailable today',
          cancel_rest_of_today: true,
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'booking_cleaner_cancel_today_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(state.cancelCalls[0]).toMatchObject({
      id: 'booking_cleaner_cancel_today_1',
      options: { cancelRestOfToday: true },
    })
  })

  it('IT-CANCEL-04 reschedule proposal acceptance updates schedule fields and proposal context', async () => {
    const route = await import('@/app/api/v1/bookings/[id]/action/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/bookings/booking_action_1/action', {
        method: 'POST',
        body: JSON.stringify({
          action: 'accept_proposal',
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'booking_action_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('confirmed')
    expect(body.data.proposalContext ?? body.data.proposal_context).toBe('post_confirmation')
    expect(body.data.actionApplied ?? body.data.action_applied).toBe('accept_proposal')
  })
})
