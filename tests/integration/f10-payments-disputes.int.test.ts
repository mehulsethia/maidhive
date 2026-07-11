import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type User = { id: string; role: 'client' | 'cleaner' | 'admin' }

const seededUsers = vi.hoisted(() => ({
  client: { id: '11111111-1111-1111-1111-111111111111', role: 'client' } as User,
  cleaner: { id: '22222222-2222-2222-2222-222222222222', role: 'cleaner' } as User,
  admin: { id: '33333333-3333-3333-3333-333333333333', role: 'admin' } as User,
}))

const state = vi.hoisted(() => ({
  currentUser: seededUsers.admin as User | null,
  booking: {
    id: 'booking_pay_1',
    status: 'completed',
    clientId: 'client_profile_1',
    cleanerId: 'cleaner_profile_1',
    scheduledStart: new Date('2099-01-01T10:00:00.000Z'),
    scheduledEnd: new Date('2099-01-01T12:00:00.000Z'),
    client: { userId: seededUsers.client.id, user: { email: 'client@test.local', name: 'Client' } },
    cleaner: { userId: seededUsers.cleaner.id, user: { email: 'cleaner@test.local', name: 'Cleaner' } },
  } as any,
  payment: {
    id: 'payment_1',
    bookingId: 'booking_pay_1',
    status: 'authorized',
    amount: 80,
    currency: 'eur',
    platformFee: 8,
    cleanerPayout: 72,
    stripePaymentIntentId: 'pi_123',
    stripeChargeId: null,
  } as any,
  dispute: {
    id: 'dispute_1',
    bookingId: 'booking_pay_1',
    status: 'open',
  } as any | null,
  notifications: [] as any[],
  emails: [] as any[],
  webhookEventType: 'charge.captured',
  webhookEventId: 'evt_1',
  transfersSeen: new Set<string>(),
}))

vi.mock('@/server/auth', () => {
  const unauthorized = () =>
    new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 })
  const forbidden = () =>
    new Response(JSON.stringify({ success: false, message: 'Forbidden' }), { status: 403 })

  return {
    requireAdmin: (handler: any) => async (req: NextRequest, ctx: any) => {
      if (!state.currentUser) return unauthorized()
      if (state.currentUser.role !== 'admin') return forbidden()
      return handler(req, ctx, state.currentUser)
    },
    requireAuth: (handler: any) => async (req: NextRequest, ctx: any) => {
      if (!state.currentUser) return unauthorized()
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

vi.mock('@/server/repositories/payment.repo', () => ({
  paymentRepo: {
    findByBookingId: vi.fn(async (bookingId: string) => (bookingId === state.payment.bookingId ? state.payment : null)),
    findByStripeIntentId: vi.fn(async (intentId: string) => (intentId === state.payment.stripePaymentIntentId ? state.payment : null)),
    findByStripeChargeId: vi.fn(async (chargeId: string) => (chargeId === state.payment.stripeChargeId ? state.payment : null)),
    update: vi.fn(async (_id: string, patch: any) => {
      state.payment = { ...state.payment, ...patch }
      return state.payment
    }),
  },
}))

vi.mock('@/server/repositories/dispute.repo', () => ({
  disputeRepo: {
    findById: vi.fn(async (id: string) => (id === state.dispute?.id ? state.dispute : null)),
    findByBookingId: vi.fn(async (bookingId: string) => (state.dispute?.bookingId === bookingId ? state.dispute : null)),
    create: vi.fn(async (payload: any) => {
      state.dispute = { id: 'dispute_created_1', status: 'open', ...payload }
      return state.dispute
    }),
    listForAdmin: vi.fn(async (_page: number, _pageSize: number, queue: string) => {
      const dispute = {
        id: queue === 'resolved' ? 'dispute_resolved_1' : 'dispute_active_1',
        bookingId: state.booking.id,
        status: queue === 'resolved' ? 'resolved' : 'under_review',
        reason: 'Service issue',
        resolutionType: queue === 'resolved' ? 'partial_refund' : null,
        refundAmount: queue === 'resolved' ? 20 : null,
        resolvedAt: queue === 'resolved' ? new Date('2026-06-19T04:03:00.000Z') : null,
        createdAt: new Date('2026-06-18T04:03:00.000Z'),
      }
      return [[dispute], 1]
    }),
    listByParticipantUserId: vi.fn(async () => [[], 0]),
    update: vi.fn(async (_id: string, patch: any) => {
      state.dispute = {
        id: _id,
        bookingId: state.booking.id,
        status: 'open',
        ...(state.dispute ?? {}),
        ...patch,
      }
      return state.dispute
    }),
    attachParticipantResponse: vi.fn(async (_id: string, payload: any) => {
      if (!state.dispute || state.dispute.respondedBy || state.dispute.respondedAt) return { count: 0 }
      state.dispute = {
        ...state.dispute,
        responseExplanation: payload.explanation,
        responseEvidence: payload.evidence ?? null,
        respondedBy: payload.respondedBy,
        responderRole: payload.responderRole,
        respondedAt: payload.respondedAt,
        status: 'under_review',
      }
      return { count: 1 }
    }),
  },
}))

vi.mock('@/server/repositories/client.repo', () => ({
  clientRepo: {
    findByUserId: vi.fn(async (userId: string) => {
      if (userId === seededUsers.client.id) return { id: 'client_profile_1', userId }
      return null
    }),
  },
}))

vi.mock('@/server/services/loops-email.service', () => ({
  loopsEmailService: {
    sendClientPaymentReceipt: vi.fn(async () => true),
    sendCleanerPayoutNotification: vi.fn(async () => true),
    sendAdminDisputeRaised: vi.fn(async (payload: any) => {
      state.emails.push({ kind: 'admin_dispute_raised', ...payload })
      return true
    }),
    sendDisputeSubmittedConfirmation: vi.fn(async (payload: any) => {
      state.emails.push({ kind: 'dispute_submitted_confirmation', ...payload })
      return true
    }),
    sendDisputeRaisedAgainstNotification: vi.fn(async (payload: any) => {
      state.emails.push({ kind: 'dispute_raised_against_notification', ...payload })
      return true
    }),
  },
}))

vi.mock('@/server/services/payment-authorization.service', () => ({
  paymentAuthorizationService: {
    syncFromPaymentIntent: vi.fn(async () => ({ updated: true, reason: 'authorized_pending_notified' })),
  },
}))

vi.mock('@/server/services/in-app-notification.service', () => ({
  pushInAppNotification: vi.fn(async (payload: any) => {
    state.notifications.push(payload)
    return true
  }),
}))

vi.mock('@/server/repositories/cleaner.repo', () => ({
  cleanerRepo: {
    findById: vi.fn(async () => null),
    findByUserId: vi.fn(async (userId: string) => {
      if (userId === seededUsers.cleaner.id) return { id: 'cleaner_profile_1', userId }
      return null
    }),
    update: vi.fn(async () => true),
  },
}))

vi.mock('@/server/db', () => ({
  db: {
    user: {
      findMany: vi.fn(async () => [{ id: seededUsers.admin.id }]),
    },
  },
}))

vi.mock('@/server/stripe', () => ({
  stripe: {
    paymentIntents: {
      capture: vi.fn(async () => ({ latest_charge: 'ch_captured' })),
      retrieve: vi.fn(async () => ({
        id: state.payment.stripePaymentIntentId,
        status: 'requires_capture',
      })),
      cancel: vi.fn(async () => ({ id: 'pi_cancelled' })),
    },
    refunds: {
      create: vi.fn(async () => ({ id: 're_1' })),
    },
    webhooks: {
      constructEvent: vi.fn(() => {
        if (state.webhookEventType === 'transfer.created') {
          const chargeId = state.payment.stripeChargeId ?? 'ch_captured'
          state.payment = { ...state.payment, stripeChargeId: chargeId }
          return {
            id: state.webhookEventId,
            type: 'transfer.created',
            data: { object: { id: `tr_${state.webhookEventId}`, source_transaction: chargeId } },
          }
        }

        return {
          id: state.webhookEventId,
          type: 'charge.captured',
          data: { object: { id: 'ch_captured', payment_intent: state.payment.stripePaymentIntentId } },
        }
      }),
    },
    accounts: {
      retrieve: vi.fn(async () => ({
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
        requirements: { currently_due: [], past_due: [], disabled_reason: null },
      })),
    },
  },
}))

describe('F10 Payments capture/refund/dispute integration', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.admin as User
    state.booking = {
      id: 'booking_pay_1',
      status: 'completed',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      scheduledStart: new Date('2099-01-01T10:00:00.000Z'),
      scheduledEnd: new Date('2099-01-01T12:00:00.000Z'),
      client: { userId: seededUsers.client.id, user: { email: 'client@test.local', name: 'Client' } },
      cleaner: { userId: seededUsers.cleaner.id, user: { email: 'cleaner@test.local', name: 'Cleaner' } },
    } as any
    state.payment = {
      id: 'payment_1',
      bookingId: 'booking_pay_1',
      status: 'authorized',
      amount: 80,
      currency: 'eur',
      platformFee: 8,
      cleanerPayout: 72,
      stripePaymentIntentId: 'pi_123',
      stripeChargeId: null,
    } as any
    state.dispute = {
      id: 'dispute_1',
      bookingId: 'booking_pay_1',
      status: 'open',
    } as any
    state.notifications = []
    state.emails = []
    state.webhookEventType = 'charge.captured'
    state.webhookEventId = 'evt_1'
    state.transfersSeen.clear()
  })

  it('IT-PAY-00 admin can fetch resolved dispute history separately from the active queue', async () => {
    const route = await import('@/app/api/v1/disputes/route')
    const res = await route.GET(
      new NextRequest('http://localhost/api/v1/disputes?status=resolved&page=1&page_size=50'),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.total).toBe(1)
    expect(body.data.disputes[0]).toMatchObject({
      status: 'resolved',
      resolution_type: 'partial_refund',
      refund_amount: 20,
    })
  })

  it('IT-PAY-01 capture endpoint captures authorized payment for completed booking', async () => {
    const route = await import('@/app/api/v1/payments/capture/[bookingId]/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/payments/capture/booking_pay_1', { method: 'POST' }),
      { params: Promise.resolve({ bookingId: 'booking_pay_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('captured')
    expect(body.data.stripeChargeId ?? body.data.stripe_charge_id).toBe('ch_captured')
  })

  it('IT-PAY-02 capture endpoint rejects non-authorized payment safely', async () => {
    state.payment = { ...state.payment, status: 'pending' }
    const route = await import('@/app/api/v1/payments/capture/[bookingId]/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/payments/capture/booking_pay_1', { method: 'POST' }),
      { params: Promise.resolve({ bookingId: 'booking_pay_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.message).toContain('authorized')
  })

  it('IT-PAY-03 webhook replay for same charge does not duplicate notifications', async () => {
    const route = await import('@/app/api/v1/payments/webhook/route')

    const first = await route.POST(
      new NextRequest('http://localhost/api/v1/payments/webhook', {
        method: 'POST',
        body: JSON.stringify({ replay: 1 }),
        headers: { 'stripe-signature': 'sig_1' },
      }),
    )
    const second = await route.POST(
      new NextRequest('http://localhost/api/v1/payments/webhook', {
        method: 'POST',
        body: JSON.stringify({ replay: 2 }),
        headers: { 'stripe-signature': 'sig_1' },
      }),
    )

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)

    const paymentCapturedNotifs = state.notifications.filter((item) => item.type === 'payment_captured')
    expect(paymentCapturedNotifs).toHaveLength(1)
  })

  it('IT-PAY-04 dispute status update requires admin and updates under_review', async () => {
    const route = await import('@/app/api/v1/disputes/[id]/status/route')
    const res = await route.PATCH(
      new NextRequest('http://localhost/api/v1/disputes/dispute_1/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'under_review' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'dispute_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('under_review')
  })

  it('IT-PAY-08 partial refund captures the authorized amount minus the euro refund', async () => {
    const route = await import('@/app/api/v1/disputes/[id]/resolve/route')
    const { stripe } = await import('@/server/stripe')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/disputes/dispute_1/resolve', {
        method: 'POST',
        body: JSON.stringify({
          resolution_type: 'partial_refund',
          resolution_note: 'Half of the requested work was not completed.',
          refund_amount: 20,
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'dispute_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(stripe.paymentIntents.capture).toHaveBeenCalledWith('pi_123', {
      amount_to_capture: 6000,
      application_fee_amount: 800,
    })
    expect(state.payment.refundAmount).toBe(20)
    expect(state.payment.cleanerPayout).toBe(52)
    expect(state.payment.platformFee).toBe(8)
    expect(state.notifications).toEqual(expect.arrayContaining([
      expect.objectContaining({
        userId: seededUsers.admin.id,
        type: 'dispute_resolved',
        body: 'Dispute resolved — Partial refund €20.00 issued to client.',
      }),
    ]))
  })

  it('IT-PAY-06 client report emails confirmation to client and against-notification to cleaner', async () => {
    state.currentUser = seededUsers.client
    state.dispute = null
    const route = await import('@/app/api/v1/disputes/[id]/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/disputes/booking_pay_1', {
        method: 'POST',
        body: JSON.stringify({
          issue_type: 'service_issue',
          explanation: 'Cleaner did not complete the agreed service scope.',
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'booking_pay_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(state.booking.status).toBe('disputed')
    expect(state.emails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'dispute_submitted_confirmation',
          email: 'client@test.local',
          bookingReference: 'MH-NGPAY1',
          issueType: 'Service issue',
          disputePath: '/client/report?booking=booking_pay_1',
        }),
        expect.objectContaining({
          kind: 'dispute_raised_against_notification',
          email: 'cleaner@test.local',
          bookingReference: 'MH-NGPAY1',
          issueType: 'Service issue',
          disputePath: '/cleaner/report?booking=booking_pay_1',
        }),
      ]),
    )
  })

  it('IT-PAY-07 cleaner report emails confirmation to cleaner and against-notification to client', async () => {
    state.currentUser = seededUsers.cleaner
    state.dispute = null
    const route = await import('@/app/api/v1/disputes/[id]/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/disputes/booking_pay_1', {
        method: 'POST',
        body: JSON.stringify({
          issue_type: 'access_issue',
          explanation: 'Client did not provide safe access to the property.',
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'booking_pay_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(state.booking.status).toBe('disputed')
    expect(state.emails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'dispute_submitted_confirmation',
          email: 'cleaner@test.local',
          bookingReference: 'MH-NGPAY1',
          issueType: 'Access issue',
          disputePath: '/cleaner/report?booking=booking_pay_1',
        }),
        expect.objectContaining({
          kind: 'dispute_raised_against_notification',
          email: 'client@test.local',
          bookingReference: 'MH-NGPAY1',
          issueType: 'Access issue',
          disputePath: '/client/report?booking=booking_pay_1',
        }),
      ]),
    )
  })

  it('IT-PAY-09 attaches the counterparty response to the existing case exactly once', async () => {
    state.currentUser = seededUsers.client
    state.dispute = null
    const route = await import('@/app/api/v1/disputes/[id]/route')
    const first = await route.POST(
      new NextRequest('http://localhost/api/v1/disputes/booking_pay_1', {
        method: 'POST',
        body: JSON.stringify({
          issue_type: 'service_issue',
          explanation: 'Cleaner did not complete the agreed service scope.',
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'booking_pay_1' }) } as any,
    )

    const disputeId = state.dispute.id
    state.currentUser = seededUsers.cleaner
    const responseRequest = () => new NextRequest('http://localhost/api/v1/disputes/booking_pay_1', {
      method: 'POST',
      body: JSON.stringify({
        issue_type: 'access_issue',
        explanation: 'The property access issue prevented completion of the agreed scope.',
        evidence: ['https://example.test/access.png'],
      }),
      headers: { 'content-type': 'application/json' },
    })
    const response = await route.POST(
      responseRequest(),
      { params: Promise.resolve({ id: 'booking_pay_1' }) } as any,
    )
    const duplicate = await route.POST(
      responseRequest(),
      { params: Promise.resolve({ id: 'booking_pay_1' }) } as any,
    )

    expect(first.status).toBe(201)
    expect(response.status).toBe(200)
    expect(duplicate.status).toBe(409)
    expect(state.dispute).toMatchObject({
      id: disputeId,
      bookingId: state.booking.id,
      respondedBy: seededUsers.cleaner.id,
      responderRole: 'cleaner',
      status: 'under_review',
    })
  })

  it('IT-PAY-05 transfer webhook marks payment transferred and pushes payout notification once', async () => {
    const route = await import('@/app/api/v1/payments/webhook/route')

    state.payment = {
      ...state.payment,
      status: 'captured',
      stripeChargeId: 'ch_captured',
    }

    state.webhookEventType = 'transfer.created'
    state.webhookEventId = 'evt_transfer_1'

    const first = await route.POST(
      new NextRequest('http://localhost/api/v1/payments/webhook', {
        method: 'POST',
        body: JSON.stringify({ replay: 1 }),
        headers: { 'stripe-signature': 'sig_transfer' },
      }),
    )

    const second = await route.POST(
      new NextRequest('http://localhost/api/v1/payments/webhook', {
        method: 'POST',
        body: JSON.stringify({ replay: 2 }),
        headers: { 'stripe-signature': 'sig_transfer' },
      }),
    )

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)

    const payoutNotifs = state.notifications.filter((item) => item.type === 'payout_released')
    expect(payoutNotifs).toHaveLength(1)
    expect(state.payment.status).toBe('transferred')
  })
})
