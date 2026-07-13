import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type User = { id: string; role: 'client' | 'cleaner' | 'admin' }

const seededUsers = vi.hoisted(() => ({
  client: { id: '11111111-1111-1111-1111-111111111111', role: 'client' } as User,
}))

const state = vi.hoisted(() => ({
  currentUser: seededUsers.client as User | null,
  nowMs: Date.now(),
  existingReview: null as any,
  createdReview: null as any,
  notifications: [] as any[],
  booking: {
    id: 'booking_review_1',
    status: 'completed',
    completedAt: new Date('2026-05-10T10:05:00.000Z'),
    scheduledEnd: new Date('2026-05-10T10:00:00.000Z'),
    cleanerId: 'cleaner_profile_1',
    clientId: 'client_profile_1',
    cleaner: { userId: 'cleaner_user_1' },
    dispute: null,
  } as any,
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
    findById: vi.fn(async (bookingId: string) => (bookingId === state.booking.id ? state.booking : null)),
  },
}))

vi.mock('@/server/repositories/client.repo', () => ({
  clientRepo: {
    findByUserId: vi.fn(async (userId: string) => (
      userId === seededUsers.client.id ? { id: 'client_profile_1', userId } : null
    )),
  },
}))

vi.mock('@/server/repositories/review.repo', () => ({
  reviewRepo: {
    findByBookingId: vi.fn(async () => state.existingReview),
    create: vi.fn(async (payload: any) => {
      state.createdReview = {
        id: 'review_1',
        ...payload,
      }
      return state.createdReview
    }),
  },
}))

vi.mock('@/server/services/in-app-notification.service', () => ({
  pushInAppNotification: vi.fn(async (payload: any) => {
    state.notifications.push(payload)
    return true
  }),
}))

vi.mock('@/server/services/cleaner-reliability.service', () => ({
  cleanerReliabilityService: {
    recalculate: vi.fn(async () => true),
    markDirty: vi.fn(async () => true),
  },
}))

describe('Post-24h reviews + notifications integration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.client as User
    state.nowMs = new Date('2026-05-10T11:00:00.000Z').getTime()
    state.existingReview = null
    state.createdReview = null
    state.notifications = []
    state.booking = {
      id: 'booking_review_1',
      status: 'completed',
      completedAt: new Date('2026-05-10T10:05:00.000Z'),
      scheduledEnd: new Date('2026-05-10T10:00:00.000Z'),
      cleanerId: 'cleaner_profile_1',
      clientId: 'client_profile_1',
      cleaner: { userId: 'cleaner_user_1' },
      dispute: null,
    } as any
    vi.spyOn(Date, 'now').mockReturnValue(state.nowMs)
  })

  it('creates a review for completed booking and notifies cleaner', async () => {
    const route = await import('@/app/api/v1/reviews/[bookingId]/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/reviews/booking_review_1', {
        method: 'POST',
        body: JSON.stringify({ rating: 5, comment: 'Great service', is_public: true }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ bookingId: 'booking_review_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(state.createdReview).toBeTruthy()
    expect(state.notifications).toHaveLength(1)
    expect(state.notifications[0].type).toBe('review_received')
    expect(state.notifications[0].title).toBe('You received a new review.')
  })

  it('prevents duplicate review submissions', async () => {
    state.existingReview = { id: 'existing_review_1' }

    const route = await import('@/app/api/v1/reviews/[bookingId]/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/reviews/booking_review_1', {
        method: 'POST',
        body: JSON.stringify({ rating: 4, comment: 'Nice', is_public: true }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ bookingId: 'booking_review_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.success).toBe(false)
    expect(body.message).toContain('Review already submitted')
  })

  it('locks new review submissions while a dispute is under review', async () => {
    state.booking = {
      ...state.booking,
      dispute: { id: 'dispute_1', status: 'under_review' },
    }

    const route = await import('@/app/api/v1/reviews/[bookingId]/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/reviews/booking_review_1', {
        method: 'POST',
        body: JSON.stringify({ rating: 5, comment: 'Great service', is_public: true }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ bookingId: 'booking_review_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.success).toBe(false)
    expect(body.message).toContain('Reviews are locked')
    expect(state.createdReview).toBeNull()
  })

  it('blocks review submission before booking completion window starts', async () => {
    state.nowMs = new Date('2026-05-10T09:30:00.000Z').getTime()
    state.booking = {
      ...state.booking,
      completedAt: null,
      status: 'confirmed',
    }
    vi.spyOn(Date, 'now').mockReturnValue(state.nowMs)

    const route = await import('@/app/api/v1/reviews/[bookingId]/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/reviews/booking_review_1', {
        method: 'POST',
        body: JSON.stringify({ rating: 5, comment: 'Great', is_public: true }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ bookingId: 'booking_review_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.message).toContain('Can only review completed bookings')
  })
})
