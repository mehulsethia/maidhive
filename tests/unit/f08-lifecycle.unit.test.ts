import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  autoStartDue: [] as Array<{ id: string; scheduledStart: Date }>,
  autoCompleteDue: [] as Array<{ id: string; status: string; scheduledEnd: Date; dispute: { status: string } | null }>,
  acceptedExpired: [] as any[],
  bookingUpdates: [] as any[],
  notifications: [] as any[],
  clientReauthorisationCancelledPayloads: [] as any[],
  cleanerReauthorisationCancelledPayloads: [] as any[],
  clientRejectedEmails: 0,
  startCalls: [] as string[],
  completeCalls: [] as string[],
}))

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findMany: vi.fn(async (query: any) => {
        if (query?.where?.status === 'accepted' && query?.where?.payBy?.lt) {
          return state.acceptedExpired
        }
        if (query?.where?.status?.in?.includes('accepted')) {
          return state.autoStartDue
        }
        return state.autoCompleteDue
      }),
      update: vi.fn(async (args: any) => {
        state.bookingUpdates.push(args)
        return { id: args.where.id, ...args.data }
      }),
    },
    payment: {
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}))

vi.mock('@/server/stripe', () => ({
  stripe: {
    paymentIntents: {
      capture: vi.fn(async () => ({ latest_charge: 'ch_1' })),
      cancel: vi.fn(async () => ({ id: 'pi_cancelled' })),
    },
  },
}))

vi.mock('@/server/services/loops-email.service', () => ({
  loopsEmailService: {
    sendCleanerPayoutNotification: vi.fn(async () => true),
    sendClientPaymentReceipt: vi.fn(async () => true),
    sendClientBookingRejectedOrExpired: vi.fn(async () => {
      state.clientRejectedEmails += 1
      return true
    }),
    sendClientPaymentReauthorisationCancelled: vi.fn(async (payload: any) => {
      state.clientReauthorisationCancelledPayloads.push(payload)
      return true
    }),
    sendCleanerPaymentReauthorisationCancelled: vi.fn(async (payload: any) => {
      state.cleanerReauthorisationCancelledPayloads.push(payload)
      return true
    }),
  },
}))

vi.mock('@/server/services/in-app-notification.service', () => ({
  pushInAppNotification: vi.fn(async (payload: any) => {
    state.notifications.push(payload)
    return true
  }),
}))

vi.mock('@/server/services/booking.service', () => ({
  bookingService: {
    startBySystem: vi.fn(async (id: string) => {
      state.startCalls.push(id)
      return { id, status: 'in_progress' }
    }),
    completeBySystem: vi.fn(async (id: string) => {
      state.completeCalls.push(id)
      return { id, status: 'completed' }
    }),
  },
}))

describe('F08 lifecycle unit coverage', () => {
  beforeEach(() => {
    vi.resetModules()
    state.autoStartDue = []
    state.autoCompleteDue = []
    state.acceptedExpired = []
    state.bookingUpdates = []
    state.notifications = []
    state.clientReauthorisationCancelledPayloads = []
    state.cleanerReauthorisationCancelledPayloads = []
    state.clientRejectedEmails = 0
    state.startCalls = []
    state.completeCalls = []
  })

  it('UT-LIFECYCLE-01 auto-start eligibility starts due confirmed/accepted bookings', async () => {
    state.autoStartDue = [
      { id: 'b1', scheduledStart: new Date('2026-06-10T09:00:00.000Z') },
      { id: 'b2', scheduledStart: new Date('2026-06-10T10:00:00.000Z') },
    ]

    const { paymentLifecycleService } = await import('@/server/services/payment-lifecycle.service')
    const summary = await paymentLifecycleService.processAutoStarts()

    expect(summary.checked).toBe(2)
    expect(summary.started).toBe(2)
    expect(state.startCalls).toEqual(['b1', 'b2'])
  })

  it('UT-LIFECYCLE-02 auto-complete keeps booking lifecycle independent from unresolved disputes', async () => {
    state.autoCompleteDue = [
      {
        id: 'b1',
        status: 'in_progress',
        scheduledEnd: new Date('2026-06-10T11:00:00.000Z'),
        dispute: null,
      },
      {
        id: 'b2',
        status: 'confirmed',
        scheduledEnd: new Date('2026-06-10T12:00:00.000Z'),
        dispute: { status: 'open' },
      },
    ]

    const { paymentLifecycleService } = await import('@/server/services/payment-lifecycle.service')
    const summary = await paymentLifecycleService.processAutoCompletions()

    expect(summary.checked).toBe(2)
    expect(summary.completed).toBe(2)
    expect(state.completeCalls).toEqual(['b1', 'b2'])
  })

  it('UT-LIFECYCLE-03 auto-complete processes disputed booking when dispute is resolved', async () => {
    state.autoCompleteDue = [
      {
        id: 'b3',
        status: 'disputed',
        scheduledEnd: new Date('2026-06-10T13:00:00.000Z'),
        dispute: { status: 'resolved' },
      },
    ]

    const { paymentLifecycleService } = await import('@/server/services/payment-lifecycle.service')
    const summary = await paymentLifecycleService.processAutoCompletions()

    expect(summary.checked).toBe(1)
    expect(summary.completed).toBe(1)
    expect(summary.failed).toBe(0)
    expect(state.completeCalls).toEqual(['b3'])
  })

  it('UT-LIFECYCLE-04 auto-cancels unresolved re-authorisation by deadline without grace-period copy', async () => {
    state.acceptedExpired = [
      {
        id: 'booking_reauth_expired',
        status: 'accepted',
        payBy: new Date('2026-08-14T16:30:00.000Z'),
        reauthorizationRequired: true,
        scheduledStart: new Date('2026-08-14T18:30:00.000Z'),
        durationHours: 2,
        payment: { id: 'payment_released', status: 'released' },
        client: {
          userId: 'client_user_1',
          user: { email: 'client@test.local', name: 'Client' },
        },
        cleaner: {
          userId: 'cleaner_user_1',
          user: { email: 'cleaner@test.local', name: 'Cleaner' },
        },
      },
    ]

    const { paymentLifecycleService } = await import('@/server/services/payment-lifecycle.service')
    const summary = await paymentLifecycleService.expireBookingDeadlines()

    expect(summary.expired_accepted).toBe(1)
    expect(state.bookingUpdates).toContainEqual(expect.objectContaining({
      where: { id: 'booking_reauth_expired' },
      data: expect.objectContaining({
        status: 'cancelled',
        cancellationReason: 'Payment re-authorisation was not completed by the deadline after reschedule. No penalties applied.',
        reauthorizationRequired: false,
        reauthorizationGraceExpiresAt: null,
        payBy: null,
      }),
    }))
    expect(state.notifications).toEqual(expect.arrayContaining([
      expect.objectContaining({
        userId: 'client_user_1',
        title: 'Booking cancelled after unresolved re-authorisation',
        body: 'Payment re-authorisation was not completed by the deadline. Your booking was automatically cancelled with no penalties.',
      }),
      expect.objectContaining({
        userId: 'cleaner_user_1',
        title: 'Booking cancelled after unresolved re-authorisation',
        body: 'The client did not complete payment re-authorisation by the deadline. The booking was automatically cancelled with no penalty to you.',
      }),
    ]))
    expect(state.notifications.map((notification) => notification.body).join(' ')).not.toMatch(/grace period|24-hour/i)
    expect(state.clientRejectedEmails).toBe(0)
    expect(state.clientReauthorisationCancelledPayloads).toEqual([
      expect.objectContaining({
        email: 'client@test.local',
        clientName: 'Client',
        cleanerName: 'Cleaner',
        scheduledStart: new Date('2026-08-14T18:30:00.000Z'),
        durationHours: 2,
      }),
    ])
    expect(state.cleanerReauthorisationCancelledPayloads).toEqual([
      expect.objectContaining({
        email: 'cleaner@test.local',
        cleanerName: 'Cleaner',
        clientName: 'Client',
        scheduledStart: new Date('2026-08-14T18:30:00.000Z'),
        durationHours: 2,
        bookingId: 'booking_reauth_expired',
      }),
    ])
  })
})
