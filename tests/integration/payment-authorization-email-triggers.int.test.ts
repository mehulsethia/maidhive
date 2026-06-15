import { beforeEach, describe, expect, it, vi } from 'vitest'

const seeded = vi.hoisted(() => ({
  clientUser: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'client@test.local',
    name: 'Client User',
  },
  cleanerUser: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'cleaner@test.local',
    name: 'Cleaner User',
  },
}))

const state = vi.hoisted(() => ({
  payment: null as any,
  booking: null as any,
  notifications: [] as any[],
  cleanerRequestEmails: [] as any[],
  clientPendingEmails: [] as any[],
  clientConfirmedEmails: [] as any[],
  calendarUpserts: [] as string[],
}))

vi.mock('@/server/repositories/payment.repo', () => ({
  paymentRepo: {
    findByStripeIntentId: vi.fn(async (intentId: string) =>
      state.payment?.stripePaymentIntentId === intentId ? state.payment : null),
    update: vi.fn(async (_id: string, patch: any) => {
      state.payment = { ...state.payment, ...patch }
      return state.payment
    }),
  },
}))

vi.mock('@/server/repositories/booking.repo', () => ({
  bookingRepo: {
    findById: vi.fn(async (id: string) => (state.booking?.id === id ? state.booking : null)),
    update: vi.fn(async (_id: string, patch: any) => {
      state.booking = { ...state.booking, ...patch }
      return state.booking
    }),
  },
}))

vi.mock('@/server/services/loops-email.service', () => ({
  loopsEmailService: {
    sendCleanerNewBookingRequest: vi.fn(async (payload: any) => {
      state.cleanerRequestEmails.push(payload)
      return true
    }),
    sendClientBookingCreatedPending: vi.fn(async (payload: any) => {
      state.clientPendingEmails.push(payload)
      return true
    }),
    sendClientBookingConfirmed: vi.fn(async (payload: any) => {
      state.clientConfirmedEmails.push(payload)
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

vi.mock('@/server/services/google-calendar.service', () => ({
  googleCalendarService: {
    upsertCleanerBookingEvent: vi.fn(async (bookingId: string) => {
      state.calendarUpserts.push(bookingId)
      return true
    }),
  },
}))

describe('payment authorization email triggers', () => {
  beforeEach(() => {
    vi.resetModules()
    state.payment = {
      id: 'payment_1',
      stripePaymentIntentId: 'pi_123',
      status: 'pending',
    }
    state.booking = {
      id: 'booking_1',
      status: 'draft',
      scheduledStart: new Date('2026-06-20T10:00:00.000Z'),
      durationHours: 2,
      cleanerId: 'cleaner_profile_1',
      client: {
        userId: seeded.clientUser.id,
        user: seeded.clientUser,
      },
      cleaner: {
        userId: seeded.cleanerUser.id,
        user: seeded.cleanerUser,
      },
    }
    state.notifications = []
    state.cleanerRequestEmails = []
    state.clientPendingEmails = []
    state.clientConfirmedEmails = []
    state.calendarUpserts = []
  })

  it('sends cleaner request and client pending emails once when a draft booking is first authorized', async () => {
    const { paymentAuthorizationService } = await import('@/server/services/payment-authorization.service')
    const paymentIntent = {
      id: 'pi_123',
      currency: 'eur',
      status: 'requires_capture',
      metadata: { booking_id: 'booking_1' },
    } as any

    const first = await paymentAuthorizationService.syncFromPaymentIntent(paymentIntent)
    const second = await paymentAuthorizationService.syncFromPaymentIntent(paymentIntent)

    expect(first.reason).toBe('authorized_draft_pending_notified')
    expect(second.reason).toBe('authorized_draft_pending_notified')
    expect(state.cleanerRequestEmails).toEqual([
      expect.objectContaining({
        email: seeded.cleanerUser.email,
        fullName: seeded.cleanerUser.name,
        clientName: seeded.clientUser.name,
        bookingId: 'booking_1',
      }),
    ])
    expect(state.clientPendingEmails).toEqual([
      expect.objectContaining({
        email: seeded.clientUser.email,
        fullName: seeded.clientUser.name,
        cleanerName: seeded.cleanerUser.name,
      }),
    ])
    expect(state.notifications.filter((item) => item.type === 'booking_request')).toHaveLength(1)
    expect(state.notifications.filter((item) => item.type === 'booking_created_pending')).toHaveLength(1)
  })

  it('sends client confirmed email when authorization completes an accepted booking', async () => {
    state.payment = {
      ...state.payment,
      status: 'pending',
    }
    state.booking = {
      ...state.booking,
      status: 'accepted',
    }
    const { paymentAuthorizationService } = await import('@/server/services/payment-authorization.service')

    const result = await paymentAuthorizationService.syncFromPaymentIntent({
      id: 'pi_123',
      currency: 'eur',
      status: 'requires_capture',
      metadata: { booking_id: 'booking_1' },
    } as any)

    expect(result.reason).toBe('authorized_accepted_confirmed')
    expect(state.clientConfirmedEmails).toEqual([
      expect.objectContaining({
        email: seeded.clientUser.email,
        fullName: seeded.clientUser.name,
        cleanerId: 'cleaner_profile_1',
        cleanerName: seeded.cleanerUser.name,
        bookingId: 'booking_1',
      }),
    ])
    expect(state.cleanerRequestEmails).toHaveLength(0)
    expect(state.clientPendingEmails).toHaveLength(0)
    expect(state.calendarUpserts).toEqual(['booking_1'])
  })
})
