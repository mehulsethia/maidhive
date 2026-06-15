import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  booking: null as any,
  notifications: [] as any[],
  completionEmails: 0,
  reviewEmails: 0,
  updateManyCalls: 0,
}))

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

vi.mock('@/server/repositories/booking.repo', () => ({
  bookingRepo: {
    findById: vi.fn(async () => state.booking),
    update: vi.fn(async (_id: string, patch: any) => ({ ...state.booking, ...patch })),
  },
}))

vi.mock('@/server/repositories/client.repo', () => ({ clientRepo: {} }))
vi.mock('@/server/repositories/cleaner.repo', () => ({ cleanerRepo: {} }))
vi.mock('@/server/repositories/availability.repo', () => ({ availabilityRepo: {} }))
vi.mock('@/server/repositories/payment.repo', () => ({ paymentRepo: {} }))
vi.mock('@/server/repositories/dispute.repo', () => ({
  disputeRepo: {
    findByBookingId: vi.fn(async () => null),
  },
}))

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      updateMany: vi.fn(async (query: any) => {
        state.updateManyCalls += 1
        if (
          state.booking?.id === query?.where?.id &&
          query?.where?.status?.in?.includes(state.booking.status) &&
          state.booking.completedAt === null
        ) {
          state.booking = {
            ...state.booking,
            status: query.data.status,
            completedAt: query.data.completedAt,
          }
          return { count: 1 }
        }
        return { count: 0 }
      }),
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    payment: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    cleanerStrike: {
      create: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
    },
  },
}))

vi.mock('@/server/services/in-app-notification.service', () => ({
  pushInAppNotification: vi.fn(async (payload: any) => {
    state.notifications.push(payload)
  }),
}))

vi.mock('@/server/services/loops-email.service', () => ({
  loopsEmailService: {
    sendClientBookingCompleted: vi.fn(async () => {
      state.completionEmails += 1
      return true
    }),
    sendClientReviewRequest: vi.fn(async () => {
      state.reviewEmails += 1
      return true
    }),
  },
}))

vi.mock('@/server/services/google-calendar.service', () => ({
  googleCalendarService: {},
}))

vi.mock('@/server/stripe', () => ({
  stripe: {
    paymentIntents: {
      capture: vi.fn(async () => ({ latest_charge: 'ch_1' })),
      cancel: vi.fn(async () => ({ id: 'pi_1' })),
    },
  },
}))

describe('booking completion idempotency', () => {
  beforeEach(() => {
    vi.resetModules()
    state.booking = {
      id: '99999999-9999-9999-9999-999999999999',
      status: 'in_progress',
      scheduledEnd: new Date('2026-06-10T10:00:00.000Z'),
      completedAt: null,
      client: {
        userId: seeded.clientUser.id,
        user: seeded.clientUser,
      },
      cleaner: {
        userId: seeded.cleanerUser.id,
        user: seeded.cleanerUser,
      },
      payment: {
        status: 'authorized',
      },
    }
    state.notifications = []
    state.completionEmails = 0
    state.reviewEmails = 0
    state.updateManyCalls = 0
  })

  it('sends completion notifications and review request only once', async () => {
    const { bookingService } = await import('@/server/services/booking.service')

    await bookingService.completeBySystem(state.booking.id, state.booking.scheduledEnd)
    await bookingService.completeBySystem(state.booking.id, state.booking.scheduledEnd)

    expect(state.updateManyCalls).toBe(1)
    expect(state.notifications).toHaveLength(2)
    expect(state.notifications.map((item) => item.userId).sort()).toEqual([
      seeded.cleanerUser.id,
      seeded.clientUser.id,
    ].sort())
    expect(state.completionEmails).toBe(1)
    expect(state.reviewEmails).toBe(1)
  })
})
