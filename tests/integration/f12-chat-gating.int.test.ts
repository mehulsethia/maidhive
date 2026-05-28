import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type User = { id: string; role: 'client' | 'cleaner' | 'admin' }

const seededUsers = vi.hoisted(() => ({
  client: { id: '11111111-1111-1111-1111-111111111111', role: 'client' } as User,
  cleaner: { id: '22222222-2222-2222-2222-222222222222', role: 'cleaner' } as User,
  stranger: { id: '44444444-4444-4444-4444-444444444444', role: 'client' } as User,
}))

const state = vi.hoisted(() => ({
  currentUser: seededUsers.client as User | null,
  clientProfile: { id: 'client_profile_1', userId: seededUsers.client.id },
  cleanerProfile: { id: 'cleaner_profile_1', userId: seededUsers.cleaner.id },
  bookings: {
    booking_allowed: {
      id: 'booking_allowed',
      status: 'confirmed',
      scheduledEnd: new Date(Date.now() + 60 * 60 * 1000),
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      _count: { messages: 1 },
    },
    booking_pending: {
      id: 'booking_pending',
      status: 'pending',
      scheduledEnd: new Date(Date.now() + 60 * 60 * 1000),
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      _count: { messages: 0 },
    },
    booking_other_party: {
      id: 'booking_other_party',
      status: 'confirmed',
      scheduledEnd: new Date(Date.now() + 60 * 60 * 1000),
      clientId: 'client_profile_other',
      cleanerId: 'cleaner_profile_other',
      _count: { messages: 0 },
    },
    booking_cancelled: {
      id: 'booking_cancelled',
      status: 'cancelled',
      scheduledEnd: new Date(Date.now() + 60 * 60 * 1000),
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      _count: { messages: 2 },
    },
  } as Record<string, any>,
  sentMessages: [] as any[],
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

vi.mock('@/server/repositories/booking.repo', () => ({
  bookingRepo: {
    findById: vi.fn(async (id: string) => state.bookings[id] ?? null),
  },
}))

vi.mock('@/server/repositories/client.repo', () => ({
  clientRepo: {
    findByUserId: vi.fn(async (userId: string) => {
      if (userId === seededUsers.client.id) return state.clientProfile
      if (userId === seededUsers.stranger.id) return { id: 'client_profile_stranger', userId }
      return null
    }),
  },
}))

vi.mock('@/server/repositories/cleaner.repo', () => ({
  cleanerRepo: {
    findByUserId: vi.fn(async (userId: string) => {
      if (userId === seededUsers.cleaner.id) return state.cleanerProfile
      return null
    }),
  },
}))

vi.mock('@/server/repositories/message.repo', () => ({
  messageRepo: {
    markReadForBooking: vi.fn(async () => true),
    findByBookingId: vi.fn(async (bookingId: string) => [
      {
        id: 'msg_1',
        bookingId,
        senderId: seededUsers.client.id,
        content: 'Hello cleaner',
      },
    ]),
    send: vi.fn(async (bookingId: string, senderId: string, content: string) => {
      const row = { id: `msg_${state.sentMessages.length + 1}`, bookingId, senderId, content }
      state.sentMessages.push(row)
      return row
    }),
  },
}))

describe('F12 chat + permissions integration', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.client as User
    state.clientProfile = { id: 'client_profile_1', userId: seededUsers.client.id }
    state.cleanerProfile = { id: 'cleaner_profile_1', userId: seededUsers.cleaner.id }
    state.bookings.booking_allowed.status = 'confirmed'
    state.bookings.booking_allowed.scheduledEnd = new Date(Date.now() + 60 * 60 * 1000)
    state.bookings.booking_pending.status = 'pending'
    state.bookings.booking_cancelled.status = 'cancelled'
    state.sentMessages = []
  })

  it('IT-CHAT-01 unrelated user cannot read/post messages for booking they do not own', async () => {
    state.currentUser = seededUsers.stranger as User
    const route = await import('@/app/api/v1/messages/[bookingId]/route')

    const getRes = await route.GET(
      new NextRequest('http://localhost/api/v1/messages/booking_other_party'),
      { params: Promise.resolve({ bookingId: 'booking_other_party' }) } as any,
    )

    const postRes = await route.POST(
      new NextRequest('http://localhost/api/v1/messages/booking_other_party', {
        method: 'POST',
        body: JSON.stringify({ content: 'Should fail' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ bookingId: 'booking_other_party' }) } as any,
    )

    expect(getRes.status).toBe(403)
    expect(postRes.status).toBe(403)
  })

  it('IT-CHAT-02 message post succeeds in allowed state and fails for read-only/cancelled booking', async () => {
    const route = await import('@/app/api/v1/messages/[bookingId]/route')

    const okRes = await route.POST(
      new NextRequest('http://localhost/api/v1/messages/booking_allowed', {
        method: 'POST',
        body: JSON.stringify({ content: 'Cleaner ETA please?' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ bookingId: 'booking_allowed' }) } as any,
    )

    const blockedRes = await route.POST(
      new NextRequest('http://localhost/api/v1/messages/booking_cancelled', {
        method: 'POST',
        body: JSON.stringify({ content: 'Follow-up after cancel' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ bookingId: 'booking_cancelled' }) } as any,
    )

    const okBody = await okRes.json()
    const blockedBody = await blockedRes.json()

    expect(okRes.status).toBe(201)
    expect(okBody.success).toBe(true)
    expect(state.sentMessages.length).toBe(1)

    expect(blockedRes.status).toBe(400)
    expect(blockedBody.success).toBe(false)
    expect(String(blockedBody.message ?? '').toLowerCase()).toContain('closed')
  })

  it('IT-CHAT-03 chat history route blocks bookings outside visibility policy', async () => {
    const route = await import('@/app/api/v1/messages/[bookingId]/route')

    const res = await route.GET(
      new NextRequest('http://localhost/api/v1/messages/booking_pending'),
      { params: Promise.resolve({ bookingId: 'booking_pending' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(String(body.message)).toContain('Chat is unavailable')
  })
})
