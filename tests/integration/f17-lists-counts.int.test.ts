import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type User = { id: string; role: 'client' | 'cleaner' | 'admin' }

const seededUsers = vi.hoisted(() => ({
  client: { id: '11111111-1111-1111-1111-111111111111', role: 'client' } as User,
  cleaner: { id: '22222222-2222-2222-2222-222222222222', role: 'cleaner' } as User,
}))

const state = vi.hoisted(() => ({
  currentUser: seededUsers.client as User | null,
  findByClientArgs: null as any,
  findByCleanerArgs: null as any,
  countsResponse: {
    unreadChats: 2,
    pendingBookingsCleaner: 3,
    pendingBookingsClient: 1,
    unreadNotifications: 4,
  },
}))

vi.mock('@/server/auth', () => {
  const unauthorized = () => new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 })

  return {
    requireAuth: (handler: any) => async (req: NextRequest, ctx: any) => {
      if (!state.currentUser) return unauthorized()
      return handler(req, ctx, state.currentUser)
    },
    requireClient: (handler: any) => async (req: NextRequest, ctx: any) => {
      if (!state.currentUser) return unauthorized()
      if (state.currentUser.role !== 'client') {
        return new Response(JSON.stringify({ success: false, message: 'Forbidden' }), { status: 403 })
      }
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
    findByClient: vi.fn(async (_clientId: string, args: any) => {
      state.findByClientArgs = args
      return [[{ id: 'b_client_1', status: args.status ?? 'accepted' }], 1]
    }),
    findByCleaner: vi.fn(async (_cleanerId: string, args: any) => {
      state.findByCleanerArgs = args
      return [[
        { id: 'b_cleaner_1', status: 'pending' },
        { id: 'b_cleaner_2', status: 'confirmed' },
      ], 2]
    }),
  },
}))

vi.mock('@/server/services/booking.service', () => ({
  bookingService: {
    reconcileDeadlinesForBookings: vi.fn(async () => false),
  },
}))

vi.mock('@/server/services/booking-visibility.service', () => ({
  sanitizeBookingsForRole: vi.fn((bookings: any[], role: string) =>
    bookings.map((b) => ({ ...b, _role_sanitized: role }))),
}))

vi.mock('@/server/repositories/notification.repo', () => ({
  notificationRepo: {
    countUnread: vi.fn(async () => state.countsResponse.unreadNotifications),
    countUnreadForUsers: vi.fn(async () => state.countsResponse.unreadNotifications),
  },
}))

vi.mock('@/server/db', () => ({
  db: {
    message: {
      count: vi.fn(async () => state.countsResponse.unreadChats),
    },
    booking: {
      count: vi.fn(async (args: any) => {
        if (args?.where?.cleaner) return state.countsResponse.pendingBookingsCleaner
        if (args?.where?.client) return state.countsResponse.pendingBookingsClient
        return 0
      }),
    },
    user: {
      findMany: vi.fn(async () => []),
    },
  },
}))

describe('F17 lists/counts/visibility integration', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.client as User
    state.findByClientArgs = null
    state.findByCleanerArgs = null
  })

  it('IT-LIST-01 list endpoint applies status + pagination deterministically', async () => {
    const route = await import('@/app/api/v1/bookings/route')

    const res = await route.GET(
      new NextRequest('http://localhost/api/v1/bookings?status=accepted&page=2&page_size=15'),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(state.findByClientArgs).toEqual({ page: 2, pageSize: 15, status: 'accepted' })
    expect(body.data.total).toBe(1)
  })

  it('IT-LIST-02 counts endpoint returns stable role metrics aligned with role query logic', async () => {
    state.currentUser = seededUsers.cleaner as User
    const route = await import('@/app/api/v1/counts/route')

    const res = await route.GET(new NextRequest('http://localhost/api/v1/counts'), {
      params: Promise.resolve({}),
    } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.unread_chats).toBe(state.countsResponse.unreadChats)
    expect(body.data.pending_bookings).toBe(state.countsResponse.pendingBookingsCleaner)
    expect(body.data.unread_notifications).toBe(state.countsResponse.unreadNotifications)
  })

  it('IT-LIST-03 cleaner list returns sanitized non-draft operational bookings payload', async () => {
    state.currentUser = seededUsers.cleaner as User
    const route = await import('@/app/api/v1/bookings/route')

    const res = await route.GET(
      new NextRequest('http://localhost/api/v1/bookings?status=pending&page=1&page_size=20'),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(state.findByCleanerArgs).toEqual({ page: 1, pageSize: 20, status: 'pending' })
    expect(body.data.bookings.every((b: any) => b._role_sanitized === 'cleaner')).toBe(true)
    expect(body.data.bookings.some((b: any) => b.status === 'draft')).toBe(false)
  })
})
