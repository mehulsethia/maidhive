import { beforeEach, describe, expect, it, vi } from 'vitest'

const seeded = vi.hoisted(() => ({
  clientUser: {
    id: '11111111-1111-1111-1111-111111111111',
    role: 'client',
    email: 'client@test.local',
    name: 'Client User',
  },
  cleanerUser: {
    id: '22222222-2222-2222-2222-222222222222',
    role: 'cleaner',
    email: 'cleaner@test.local',
    name: 'Cleaner User',
  },
}))

const state = vi.hoisted(() => ({
  booking: null as any,
  notifications: [] as any[],
  cleanerCancelledByClientEmails: 0,
  clientCancellationEmails: 0,
  removeCalendarCalls: 0,
}))

vi.mock('@/server/repositories/booking.repo', () => ({
  bookingRepo: {
    findById: vi.fn(async () => state.booking),
    update: vi.fn(async (_id: string, patch: any) => ({ ...state.booking, ...patch })),
  },
}))

vi.mock('@/server/repositories/client.repo', () => ({
  clientRepo: {
    findByUserId: vi.fn(async (userId: string) =>
      userId === seeded.clientUser.id ? { id: 'client_profile_1', userId } : null),
  },
}))

vi.mock('@/server/repositories/cleaner.repo', () => ({
  cleanerRepo: {
    findByUserId: vi.fn(async (userId: string) =>
      userId === seeded.cleanerUser.id ? { id: 'cleaner_profile_1', userId } : null),
  },
}))

vi.mock('@/server/repositories/availability.repo', () => ({
  availabilityRepo: {},
}))

vi.mock('@/server/repositories/payment.repo', () => ({
  paymentRepo: {
    update: vi.fn(async () => true),
  },
}))

vi.mock('@/server/repositories/dispute.repo', () => ({
  disputeRepo: {},
}))

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      updateMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    cleanerStrike: {
      create: vi.fn(async () => ({})),
    },
    payment: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}))

vi.mock('@/server/services/loops-email.service', () => ({
  loopsEmailService: {
    sendClientCancellationConfirmation: vi.fn(async () => {
      state.clientCancellationEmails += 1
      return true
    }),
    sendCleanerBookingCancelledByClient: vi.fn(async () => {
      state.cleanerCancelledByClientEmails += 1
      return true
    }),
    sendCleanerCancellationWarningOrStrike: vi.fn(async () => true),
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
    removeCleanerBookingEvent: vi.fn(async () => {
      state.removeCalendarCalls += 1
      return true
    }),
  },
}))

vi.mock('@/server/stripe', () => ({
  stripe: {
    paymentIntents: {
      cancel: vi.fn(async () => ({ id: 'pi_cancelled' })),
      capture: vi.fn(async () => ({ latest_charge: 'ch_1' })),
    },
  },
}))

describe('Booking cancellation communications', () => {
  beforeEach(() => {
    vi.resetModules()
    state.notifications = []
    state.cleanerCancelledByClientEmails = 0
    state.clientCancellationEmails = 0
    state.removeCalendarCalls = 0
  })

  it('uses request-cancel wording for pending request cancellations before confirmation', async () => {
    state.booking = {
      id: 'booking_pending_1',
      status: 'pending',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      scheduledStart: new Date('2026-06-20T10:00:00.000Z'),
      durationHours: 2,
      payment: { status: 'authorized', stripePaymentIntentId: null },
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: { userId: seeded.cleanerUser.id, user: { email: seeded.cleanerUser.email, name: seeded.cleanerUser.name } },
    }

    const { bookingService } = await import('@/server/services/booking.service')
    await bookingService.cancel(state.booking.id, seeded.clientUser as any, 'Cancelled before acceptance')

    expect(state.notifications).toHaveLength(1)
    expect(state.notifications[0].userId).toBe(seeded.cleanerUser.id)
    expect(state.notifications[0].title).toBe('Client cancelled booking request')
    expect(String(state.notifications[0].body)).toContain('before confirmation')
    expect(state.cleanerCancelledByClientEmails).toBe(0)
    expect(state.clientCancellationEmails).toBe(1)
  })

  it('skips cancellation notifications/emails for draft-like pending bookings without authorization', async () => {
    state.booking = {
      id: 'booking_draft_like_1',
      status: 'pending',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      scheduledStart: new Date('2026-06-20T10:00:00.000Z'),
      durationHours: 2,
      payment: { status: 'requires_payment_method', stripePaymentIntentId: null },
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: { userId: seeded.cleanerUser.id, user: { email: seeded.cleanerUser.email, name: seeded.cleanerUser.name } },
    }

    const { bookingService } = await import('@/server/services/booking.service')
    const updated = await bookingService.cancel(state.booking.id, seeded.clientUser as any, 'Cancelled draft session')

    expect(updated.status).toBe('cancelled')
    expect(state.notifications).toHaveLength(0)
    expect(state.cleanerCancelledByClientEmails).toBe(0)
    expect(state.clientCancellationEmails).toBe(0)
    expect(state.removeCalendarCalls).toBe(0)
  })

  it('uses confirmed-cancel wording and sends cleaner email + client in-app notification', async () => {
    state.booking = {
      id: 'booking_confirmed_1',
      status: 'confirmed',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      acceptedAt: new Date('2026-06-18T09:00:00.000Z'),
      confirmedAt: new Date('2026-06-18T09:05:00.000Z'),
      scheduledStart: new Date('2026-06-20T10:00:00.000Z'),
      durationHours: 2,
      payment: null,
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: { userId: seeded.cleanerUser.id, user: { email: seeded.cleanerUser.email, name: seeded.cleanerUser.name } },
    }

    const { bookingService } = await import('@/server/services/booking.service')
    await bookingService.cancel(state.booking.id, seeded.clientUser as any, 'Confirmed cancellation')

    expect(state.notifications).toHaveLength(2)

    const cleanerNotif = state.notifications.find((item) => item.userId === seeded.cleanerUser.id)
    const clientNotif = state.notifications.find((item) => item.userId === seeded.clientUser.id)

    expect(cleanerNotif?.title).toBe('Client cancelled booking')
    expect(String(cleanerNotif?.body ?? '')).toContain('confirmed booking scheduled for')
    expect(clientNotif?.title).toBe('Booking cancelled')
    expect(String(clientNotif?.body ?? '')).toContain('has been cancelled')

    expect(state.cleanerCancelledByClientEmails).toBe(1)
    expect(state.clientCancellationEmails).toBe(1)
    expect(state.removeCalendarCalls).toBe(1)
  })

  it('does not send cleaner cancellation email for accepted-but-not-confirmed cancellation', async () => {
    state.booking = {
      id: 'booking_accepted_1',
      status: 'accepted',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      acceptedAt: new Date('2026-06-18T09:00:00.000Z'),
      confirmedAt: null,
      scheduledStart: new Date('2026-06-20T10:00:00.000Z'),
      durationHours: 2,
      payment: { status: 'authorized', stripePaymentIntentId: null },
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: { userId: seeded.cleanerUser.id, user: { email: seeded.cleanerUser.email, name: seeded.cleanerUser.name } },
    }

    const { bookingService } = await import('@/server/services/booking.service')
    await bookingService.cancel(state.booking.id, seeded.clientUser as any, 'Accepted cancellation')

    expect(state.cleanerCancelledByClientEmails).toBe(0)
    expect(state.clientCancellationEmails).toBe(1)
  })

  it('cancels confirmed booking even when cleaner relation data is incomplete', async () => {
    state.booking = {
      id: 'booking_confirmed_legacy_relation',
      status: 'confirmed',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      acceptedAt: new Date('2026-06-18T09:00:00.000Z'),
      confirmedAt: new Date('2026-06-18T09:05:00.000Z'),
      scheduledStart: new Date('2026-06-20T10:00:00.000Z'),
      durationHours: 2,
      payment: null,
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: null,
    }

    const { bookingService } = await import('@/server/services/booking.service')
    const updated = await bookingService.cancel(state.booking.id, seeded.clientUser as any, 'Confirmed cancellation')

    expect(updated.status).toBe('cancelled')
    expect(state.notifications).toHaveLength(1)
    expect(state.notifications[0].userId).toBe(seeded.clientUser.id)
    expect(state.notifications[0].title).toBe('Booking cancelled')
    expect(state.cleanerCancelledByClientEmails).toBe(0)
    expect(state.clientCancellationEmails).toBe(1)
  })
})
