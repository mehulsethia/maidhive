import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type User = { id: string; role: 'cleaner' | 'client' | 'admin' }

const seededUsers = vi.hoisted(() => ({
  cleaner: { id: '22222222-2222-2222-2222-222222222222', role: 'cleaner' } as User,
}))

const state = vi.hoisted(() => ({
  currentUser: seededUsers.cleaner as User | null,
  cleaner: {
    id: 'cleaner_profile_1',
    userId: seededUsers.cleaner.id,
    status: 'approved',
    profileComplete: true,
    stripeOnboardingComplete: true,
    user: {
      id: seededUsers.cleaner.id,
      name: 'Cleaner User',
      email: 'cleaner@test.local',
      avatarUrl: null,
      phone: '+35799000000',
    },
  } as any,
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
    getAuthSessionUser: vi.fn(async () => ({ email_confirmed_at: '2026-05-01T00:00:00.000Z' })),
  }
})

vi.mock('@/server/repositories/cleaner.repo', () => ({
  cleanerRepo: {
    findByUserId: vi.fn(async (userId: string) => (userId === seededUsers.cleaner.id ? state.cleaner : null)),
    create: vi.fn(async () => state.cleaner),
    findById: vi.fn(async (id: string) => (id === state.cleaner.id ? state.cleaner : null)),
  },
}))

vi.mock('@/server/repositories/availability.repo', () => ({
  availabilityRepo: {
    getSchedule: vi.fn(async () => [{ isActive: true }]),
  },
}))

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findMany: vi.fn(async (args: any) => {
        if (args?.where?.status === 'completed') {
          return [
            {
              scheduledStart: new Date('2026-05-10T10:00:00.000Z'),
              startedAt: new Date('2026-05-10T10:10:00.000Z'),
            },
            {
              scheduledStart: new Date('2026-05-11T10:00:00.000Z'),
              startedAt: new Date('2026-05-11T10:30:00.000Z'),
            },
          ]
        }
        if (args?.where?.acceptedAt?.not === null) {
          return [
            {
              createdAt: new Date('2026-05-09T08:00:00.000Z'),
              acceptedAt: new Date('2026-05-09T08:20:00.000Z'),
            },
            {
              createdAt: new Date('2026-05-09T09:00:00.000Z'),
              acceptedAt: new Date('2026-05-09T09:40:00.000Z'),
            },
          ]
        }
        return []
      }),
    },
    review: {
      aggregate: vi.fn(async () => ({ _avg: { rating: 4.5 } })),
    },
    payment: {
      aggregate: vi.fn(async () => ({ _sum: { cleanerPayout: 68 } })),
    },
  },
}))

describe('Cleaner metrics endpoints', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.cleaner as User
    state.cleaner = {
      id: 'cleaner_profile_1',
      userId: seededUsers.cleaner.id,
      status: 'approved',
      profileComplete: true,
      stripeOnboardingComplete: true,
      user: {
        id: seededUsers.cleaner.id,
        name: 'Cleaner User',
        email: 'cleaner@test.local',
        avatarUrl: null,
        phone: '+35799000000',
      },
    } as any
  })

  it('returns cleaner-facing stats derived from completed and accepted bookings only', async () => {
    const route = await import('@/app/api/v1/cleaners/me/route')
    const res = await route.GET(
      new NextRequest('http://localhost/api/v1/cleaners/me'),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.cleaner.total_jobs).toBe(2)
    expect(body.data.cleaner.on_time_percentage).toBe(50)
    expect(body.data.cleaner.avg_response_minutes).toBe(30)
    expect(body.data.cleaner.average_rating).toBe(4.5)
    expect(body.data.cleaner.released_earnings).toBe(68)
  })

  it('returns public cleaner trust stats without exposing email/phone', async () => {
    const route = await import('@/app/api/v1/cleaners/[id]/route')
    const res = await route.GET(
      new NextRequest('http://localhost/api/v1/cleaners/cleaner_profile_1'),
      { params: Promise.resolve({ id: 'cleaner_profile_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.total_jobs).toBe(2)
    expect(body.data.on_time_percentage).toBeNull()
    expect(body.data.on_time_label).toBe('Not enough data yet')
    expect(body.data.average_rating).toBeNull()
    expect(body.data.super_cleaner).toBe(false)
    expect(body.data.reliability_snapshot).toBeUndefined()
    expect(body.data.avg_response_minutes).toBe(30)
    expect(body.data.user.email).toBeNull()
    expect(body.data.user.phone).toBeNull()
  })
})
