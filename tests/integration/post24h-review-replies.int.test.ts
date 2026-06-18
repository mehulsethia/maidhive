import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type User = { id: string; role: 'client' | 'cleaner' | 'admin' }

const seededUsers = vi.hoisted(() => ({
  cleaner: { id: '22222222-2222-2222-2222-222222222222', role: 'cleaner' } as User,
  admin: { id: '33333333-3333-3333-3333-333333333333', role: 'admin' } as User,
}))

const state = vi.hoisted(() => ({
  currentUser: seededUsers.cleaner as User | null,
  review: {
    id: 'review_1',
    cleanerId: 'cleaner_profile_1',
    cleanerReply: null as string | null,
    cleanerReplyAt: null as Date | null,
  },
}))

vi.mock('@/server/auth', () => {
  const unauthorized = () =>
    new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 })
  const forbidden = () =>
    new Response(JSON.stringify({ success: false, message: 'Forbidden' }), { status: 403 })

  return {
    requireCleaner: (handler: any) => async (req: NextRequest, ctx: any) => {
      if (!state.currentUser) return unauthorized()
      if (state.currentUser.role !== 'cleaner') return forbidden()
      return handler(req, ctx, state.currentUser)
    },
    requireAdmin: (handler: any) => async (req: NextRequest, ctx: any) => {
      if (!state.currentUser) return unauthorized()
      if (state.currentUser.role !== 'admin') return forbidden()
      return handler(req, ctx, state.currentUser)
    },
  }
})

vi.mock('@/server/repositories/cleaner.repo', () => ({
  cleanerRepo: {
    findByUserId: vi.fn(async (userId: string) => (
      userId === seededUsers.cleaner.id ? { id: 'cleaner_profile_1', userId } : null
    )),
  },
}))

vi.mock('@/server/repositories/review.repo', () => ({
  reviewRepo: {
    findById: vi.fn(async (id: string) => (id === state.review.id ? state.review : null)),
    update: vi.fn(async (_id: string, patch: any) => {
      state.review = { ...state.review, ...patch }
      return state.review
    }),
  },
}))

describe('Post-24h review replies + moderation integration', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.cleaner as User
    state.review = {
      id: 'review_1',
      cleanerId: 'cleaner_profile_1',
      cleanerReply: null,
      cleanerReplyAt: null,
    }
  })

  it('allows a one-time cleaner reply and blocks edits', async () => {
    const route = await import('@/app/api/v1/reviews/[bookingId]/reply/route')

    const first = await route.POST(
      new NextRequest('http://localhost/api/v1/reviews/review_1/reply', {
        method: 'POST',
        body: JSON.stringify({ response: 'Thanks for your feedback.' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ bookingId: 'review_1' }) } as any,
    )
    const firstBody = await first.json()
    expect(first.status).toBe(200)
    expect(firstBody.success).toBe(true)
    expect(state.review.cleanerReply).toContain('Thanks')

    const second = await route.POST(
      new NextRequest('http://localhost/api/v1/reviews/review_1/reply', {
        method: 'POST',
        body: JSON.stringify({ response: 'Updated response' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ bookingId: 'review_1' }) } as any,
    )
    const secondBody = await second.json()
    expect(second.status).toBe(409)
    expect(secondBody.success).toBe(false)
    expect(secondBody.message).toContain('cannot be edited')
  })

  it('allows a short non-empty cleaner reply', async () => {
    const route = await import('@/app/api/v1/reviews/[bookingId]/reply/route')

    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/reviews/review_1/reply', {
        method: 'POST',
        body: JSON.stringify({ response: 'Thanks!' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ bookingId: 'review_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(state.review.cleanerReply).toBe('Thanks!')
  })

  it('allows admin to remove abusive public reply', async () => {
    state.review.cleanerReply = 'bad reply'
    state.review.cleanerReplyAt = new Date('2026-05-10T11:00:00.000Z')
    state.currentUser = seededUsers.admin as User

    const route = await import('@/app/api/v1/admin/reviews/[id]/reply/route')
    const res = await route.DELETE(
      new NextRequest('http://localhost/api/v1/admin/reviews/review_1/reply', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'review_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(state.review.cleanerReply).toBeNull()
    expect(state.review.cleanerReplyAt).toBeNull()
  })
})
