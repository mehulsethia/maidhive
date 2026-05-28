import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type User = { id: string; role: 'client' | 'cleaner' | 'admin' }

const seededUsers = vi.hoisted(() => ({
  client: { id: '11111111-1111-1111-1111-111111111111', role: 'client' } as User,
  cleaner: { id: '22222222-2222-2222-2222-222222222222', role: 'cleaner' } as User,
  admin: { id: '33333333-3333-3333-3333-333333333333', role: 'admin' } as User,
}))

const state = vi.hoisted(() => ({
  currentUser: seededUsers.client as User | null,
  bookingUpdateShouldFail: true,
}))

vi.mock('@/server/auth', () => {
  const unauthorized = () => new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 })
  const forbidden = () => new Response(JSON.stringify({ success: false, message: 'Forbidden' }), { status: 403 })

  return {
    requireAuth: (handler: any) => async (req: NextRequest, ctx: any) => {
      if (!state.currentUser) return unauthorized()
      return handler(req, ctx, state.currentUser)
    },
    requireClient: (handler: any) => async (req: NextRequest, ctx: any) => {
      if (!state.currentUser) return unauthorized()
      if (state.currentUser.role !== 'client') return forbidden()
      return handler(req, ctx, state.currentUser)
    },
    requireAdmin: (handler: any) => async (req: NextRequest, ctx: any) => {
      if (!state.currentUser) return unauthorized()
      if (state.currentUser.role !== 'admin') return forbidden()
      return handler(req, ctx, state.currentUser)
    },
  }
})

vi.mock('@/server/repositories/client.repo', () => ({
  clientRepo: {
    findByUserId: vi.fn(async (userId: string) => ({ id: 'client_profile_1', userId })),
    create: vi.fn(async (userId: string) => ({ id: 'client_profile_1', userId })),
  },
}))

vi.mock('@/server/repositories/cleaner.repo', () => ({
  cleanerRepo: {
    findByUserId: vi.fn(async (userId: string) => ({ id: 'cleaner_profile_1', userId })),
    create: vi.fn(async (userId: string) => ({ id: 'cleaner_profile_1', userId })),
  },
}))

vi.mock('@/server/repositories/booking.repo', () => ({
  bookingRepo: {
    findByClient: vi.fn(async () => [[{ id: 'booking_1', status: 'pending' }], 1]),
    findByCleaner: vi.fn(async () => [[{ id: 'booking_2', status: 'confirmed' }], 1]),
    findById: vi.fn(async () => ({
      id: 'booking_1',
      client: { userId: seededUsers.client.id, user: { name: 'Client', email: 'client@test.local' } },
      cleaner: { userId: seededUsers.cleaner.id, user: { name: 'Cleaner', email: 'cleaner@test.local' } },
    })),
    update: vi.fn(async () => {
      if (state.bookingUpdateShouldFail) throw new Error('booking update failed')
      return true
    }),
  },
}))

vi.mock('@/server/services/booking.service', () => ({
  bookingService: {
    reconcileDeadlinesForBookings: vi.fn(async () => {
      throw new Error('reconcile failed')
    }),
  },
}))

vi.mock('@/server/services/booking-visibility.service', () => ({
  sanitizeBookingsForRole: vi.fn((rows: any[]) => rows),
}))

vi.mock('@/server/repositories/dispute.repo', () => ({
  disputeRepo: {
    findById: vi.fn(async () => ({ id: 'dispute_1', bookingId: 'booking_1', status: 'under_review' })),
    update: vi.fn(async () => ({ id: 'dispute_1', bookingId: 'booking_1', status: 'resolved' })),
  },
}))

vi.mock('@/server/repositories/payment.repo', () => ({
  paymentRepo: {
    findByBookingId: vi.fn(async () => null),
  },
}))

vi.mock('@/server/services/in-app-notification.service', () => ({
  pushInAppNotification: vi.fn(async () => true),
}))

vi.mock('@/server/stripe', () => ({
  stripe: {
    paymentIntents: { retrieve: vi.fn(async () => ({ status: 'requires_capture' })) },
    refunds: { create: vi.fn(async () => ({ id: 're_1' })) },
  },
}))

vi.mock('@/server/db', () => ({
  db: {
    user: {
      findMany: vi.fn(async () => [{ id: seededUsers.admin.id }]),
    },
  },
}))

describe('F16 resilience/failure isolation integration', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.client as User
    state.bookingUpdateShouldFail = true
  })

  it('IT-RES-01 bookings list still returns data when reconcile step throws', async () => {
    const route = await import('@/app/api/v1/bookings/route')

    const res = await route.GET(
      new NextRequest('http://localhost/api/v1/bookings?page=1&page_size=20'),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.total).toBe(1)
  })

  it('IT-RES-02 cleaner bookings list still returns data when reconcile step throws', async () => {
    state.currentUser = seededUsers.cleaner as User
    const route = await import('@/app/api/v1/bookings/route')

    const res = await route.GET(
      new NextRequest('http://localhost/api/v1/bookings?page=1&page_size=20'),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.total).toBe(1)
  })

  it('IT-RES-03 dispute resolve succeeds even if booking status update side-effect fails', async () => {
    state.currentUser = seededUsers.admin as User
    const route = await import('@/app/api/v1/disputes/[id]/resolve/route')

    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/disputes/dispute_1/resolve', {
        method: 'POST',
        body: JSON.stringify({ resolution_type: 'no_refund', resolution_note: 'Resolved after review' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'dispute_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('resolved')
  })
})
