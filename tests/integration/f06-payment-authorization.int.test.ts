import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const seededUsers = vi.hoisted(() => ({
  client: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'client@test.local',
    name: 'Client User',
    role: 'client',
  },
  cleaner: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'cleaner@test.local',
    name: 'Cleaner User',
    role: 'cleaner',
  },
  admin: {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'admin@test.local',
    name: 'Admin User',
    role: 'admin',
  },
}))

const state = vi.hoisted(() => ({
  currentUser: seededUsers.client as any | null,
  clientProfile: {
    id: 'client_profile_1',
    userId: seededUsers.client.id,
    stripeCustomerId: 'cus_123',
  } as any,
  booking: {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    status: 'draft',
    clientId: 'client_profile_1',
    cleanerId: 'cleaner_profile_1',
    cleaner: {
      id: 'cleaner_profile_1',
      stripeAccountId: 'acct_123',
      hourlyRate: 22,
      user: { email: seededUsers.cleaner.email, name: seededUsers.cleaner.name },
    },
    client: {
      id: 'client_profile_1',
      userId: seededUsers.client.id,
      user: { email: seededUsers.client.email, name: seededUsers.client.name },
    },
    durationHours: 3,
    hourlyRate: 22,
    subtotal: 66,
    platformFee: 6.6,
    cleanerPayout: 66,
    totalAmount: 72.6,
  } as any,
  payment: {
    id: 'payment_1',
    bookingId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    stripePaymentIntentId: 'pi_existing',
    status: 'pending',
    amount: 72.6,
    platformFee: 6.6,
    cleanerPayout: 66,
  } as any | null,
  paymentUpserts: [] as any[],
  syncCallCount: 0,
  syncResponses: [{ updated: true, reason: 'authorized_draft_pending_notified' }] as Array<{
    updated: boolean
    reason: string
  }>,
}))

vi.mock('@/server/auth', () => {
  const unauthorized = () =>
    new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 })
  const forbidden = () =>
    new Response(JSON.stringify({ success: false, message: 'Forbidden' }), { status: 403 })
  return {
    requireClient: (handler: any) => async (req: NextRequest, ctx: any) => {
      if (!state.currentUser) return unauthorized()
      if (state.currentUser.role !== 'client') return forbidden()
      return handler(req, ctx, state.currentUser)
    },
  }
})

vi.mock('@/server/repositories/booking.repo', () => ({
  bookingRepo: {
    findById: vi.fn(async (id: string) => (id === state.booking.id ? state.booking : null)),
    update: vi.fn(async (_id: string, patch: any) => {
      state.booking = { ...state.booking, ...patch }
      return state.booking
    }),
  },
}))

vi.mock('@/server/repositories/client.repo', () => ({
  clientRepo: {
    findByUserId: vi.fn(async (userId: string) => {
      if (userId !== state.clientProfile.userId) return null
      return state.clientProfile
    }),
    update: vi.fn(async (_id: string, patch: any) => {
      state.clientProfile = { ...state.clientProfile, ...patch }
      return state.clientProfile
    }),
  },
}))

vi.mock('@/server/repositories/payment.repo', () => ({
  paymentRepo: {
    findByBookingId: vi.fn(async (bookingId: string) => {
      if (!state.payment) return null
      return bookingId === state.payment.bookingId ? state.payment : null
    }),
    upsert: vi.fn(async (input: any) => {
      state.paymentUpserts.push(input)
      state.payment = {
        id: state.payment?.id ?? 'payment_1',
        bookingId: input.bookingId,
        stripePaymentIntentId: input.stripePaymentIntentId,
        status: 'pending',
        amount: input.amount,
        platformFee: input.platformFee,
        cleanerPayout: input.cleanerPayout,
      }
      return state.payment
    }),
    update: vi.fn(async (_id: string, patch: any) => {
      if (!state.payment) return null
      state.payment = { ...state.payment, ...patch }
      return state.payment
    }),
  },
}))

vi.mock('@/server/services/booking.service', () => ({
  bookingService: {
    previewPrice: vi.fn((hourlyRate: number, durationHours: number, platformFeePct = 10) => {
      const subtotal = hourlyRate * durationHours
      const platformFee = Number((subtotal * (platformFeePct / 100)).toFixed(2))
      return {
        hourly_rate: hourlyRate,
        duration_hours: durationHours,
        subtotal: Number(subtotal.toFixed(2)),
        platform_fee_pct: platformFeePct,
        platform_fee: platformFee,
        cleaner_payout: Number(subtotal.toFixed(2)),
        total_amount: Number((subtotal + platformFee).toFixed(2)),
      }
    }),
  },
}))

vi.mock('@/server/services/payment-authorization.service', () => ({
  paymentAuthorizationService: {
    syncFromPaymentIntent: vi.fn(async () => {
      state.syncCallCount += 1
      const next = state.syncResponses.shift()
      if (next) return next
      return { updated: false, reason: 'not_capturable' }
    }),
  },
}))

vi.mock('@/server/stripe', () => ({
  stripe: {
    accounts: {
      retrieve: vi.fn(async () => ({
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
        requirements: { currently_due: [], past_due: [], disabled_reason: null },
      })),
    },
    customers: {
      retrieve: vi.fn(async (id: string) => ({ id })),
      create: vi.fn(async () => ({ id: 'cus_new' })),
    },
    paymentMethods: {
      retrieve: vi.fn(async (id: string) => ({ id, customer: state.clientProfile.stripeCustomerId })),
    },
    paymentIntents: {
      create: vi.fn(async () => ({ id: 'pi_new', client_secret: 'sec_new' })),
      retrieve: vi.fn(async (id: string) => ({
        id,
        currency: 'eur',
        amount: Math.round(Number(state.booking.totalAmount) * 100),
        application_fee_amount: Math.round(Number(state.booking.platformFee) * 100),
        status: 'requires_capture',
        metadata: { booking_id: state.booking.id },
      })),
      update: vi.fn(async () => ({})),
      confirm: vi.fn(async (id: string) => ({
        id,
        currency: 'eur',
        status: 'requires_capture',
        metadata: { booking_id: state.booking.id },
      })),
    },
  },
}))

describe('F06 Payment intent + authorization sync integration', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.client as any
    state.clientProfile = {
      id: 'client_profile_1',
      userId: seededUsers.client.id,
      stripeCustomerId: 'cus_123',
    } as any
    state.booking = {
      ...state.booking,
      status: 'draft',
      totalAmount: 72.6,
      platformFee: 6.6,
      cleanerPayout: 66,
      durationHours: 3,
    }
    state.payment = {
      id: 'payment_1',
      bookingId: state.booking.id,
      stripePaymentIntentId: 'pi_existing',
      status: 'pending',
      amount: 72.6,
      platformFee: 6.6,
      cleanerPayout: 66,
    }
    state.paymentUpserts = []
    state.syncCallCount = 0
    state.syncResponses = [{ updated: true, reason: 'authorized_draft_pending_notified' }]
  })

  it('IT-PAYAUTH-01 payment intent creation links payment and booking', async () => {
    state.payment = null
    const route = await import('@/app/api/v1/payments/intent/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/payments/intent', {
        method: 'POST',
        body: JSON.stringify({ booking_id: state.booking.id }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.payment_intent_id).toBe('pi_new')
    expect(state.paymentUpserts).toHaveLength(1)
    expect(state.paymentUpserts[0].bookingId).toBe(state.booking.id)
  })

  it('IT-PAYAUTH-02 confirm capturable intent sets authorized and pending', async () => {
    state.syncResponses = [{ updated: true, reason: 'authorized_pending_notified' }]
    const route = await import('@/app/api/v1/payments/confirm-existing/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/payments/confirm-existing', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: state.booking.id,
          payment_method_id: 'pm_1',
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.payment_intent_status).toBe('requires_capture')
    expect(body.data.sync.updated).toBe(true)
    expect(body.data.sync.reason).toBe('authorized_pending_notified')
  })

  it('IT-PAYAUTH-03 authorization sync sends exactly one cleaner request notification', async () => {
    state.syncResponses = [{ updated: true, reason: 'authorized_draft_pending_notified' }]
    const route = await import('@/app/api/v1/payments/confirm-existing/route')
    await route.POST(
      new NextRequest('http://localhost/api/v1/payments/confirm-existing', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: state.booking.id,
          payment_method_id: 'pm_1',
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) } as any,
    )

    expect(state.syncCallCount).toBe(1)
  })

  it('IT-PAYAUTH-04 re-sync remains idempotent', async () => {
    state.syncResponses = [
      { updated: true, reason: 'authorized_pending_notified' },
      { updated: false, reason: 'not_capturable' },
    ]
    const route = await import('@/app/api/v1/payments/sync/[bookingId]/route')

    const firstRes = await route.POST(
      new NextRequest(`http://localhost/api/v1/payments/sync/${state.booking.id}`),
      { params: Promise.resolve({ bookingId: state.booking.id }) } as any,
    )
    const secondRes = await route.POST(
      new NextRequest(`http://localhost/api/v1/payments/sync/${state.booking.id}`),
      { params: Promise.resolve({ bookingId: state.booking.id }) } as any,
    )
    const firstBody = await firstRes.json()
    const secondBody = await secondRes.json()

    expect(firstRes.status).toBe(200)
    expect(secondRes.status).toBe(200)
    expect(firstBody.data.sync.updated).toBe(true)
    expect(secondBody.data.sync.updated).toBe(false)
    expect(state.syncCallCount).toBe(2)
  })
})
