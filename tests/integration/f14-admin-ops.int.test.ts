import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type User = { id: string; role: 'client' | 'cleaner' | 'admin' }

const seededUsers = vi.hoisted(() => ({
  admin: { id: '33333333-3333-3333-3333-333333333333', role: 'admin' } as User,
  client: { id: '11111111-1111-1111-1111-111111111111', role: 'client' } as User,
}))

const state = vi.hoisted(() => ({
  currentUser: seededUsers.admin as User | null,
  listAllArgs: null as any,
}))

vi.mock('@/server/auth', () => {
  const unauthorized = () =>
    new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 })
  const forbidden = () =>
    new Response(JSON.stringify({ success: false, message: 'Forbidden' }), { status: 403 })

  return {
    requireAdmin: (handler: any) => async (req: NextRequest, ctx: any) => {
      if (!state.currentUser) return unauthorized()
      if (state.currentUser.role !== 'admin') return forbidden()
      return handler(req, ctx, state.currentUser)
    },
  }
})

vi.mock('@/server/repositories/cleaner.repo', () => ({
  cleanerRepo: {
    listPending: vi.fn(async () => [
      {
        id: 'cleaner_pending_1',
        user: { name: 'Pending Cleaner', email: 'pending@test.local' },
        yearsExperience: 3,
        transportMode: 'own_car',
        cleaningSupplies: 'cleaner_brings',
        standardsCompleted: true,
        quizPassed: true,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    ]),
    listAll: vi.fn(async (_query: any) => [[
      {
        id: 'cleaner_approved_1',
        userId: 'user_cleaner_1',
        user: { name: 'Approved Cleaner', email: 'approved@test.local', phone: '+35799000000' },
        status: 'approved',
        stripeOnboardingComplete: true,
        profileComplete: true,
        profileImageUrl: null,
        bio: 'Bio',
        skills: ['kitchen'],
        cleaningSupplies: 'cleaner_brings',
        yearsExperience: 5,
        hourlyRate: 15,
        transportMode: 'own_car',
        idType: 'passport',
        idFileName: 'id.pdf',
        idFileUrl: 'https://example.test/id.pdf',
        rejectionReason: null,
        identityVerified: true,
        cleaningStandardsAccepted: true,
        standardsCompleted: true,
        quizPassed: true,
        quizScore: 90,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ], 1]),
  },
}))

vi.mock('@/server/repositories/booking.repo', () => ({
  bookingRepo: {
    listAll: vi.fn(async (query: any) => {
      state.listAllArgs = query
      return [[
        {
          id: 'booking_admin_1',
          status: query.status ?? 'pending',
          city: 'Larnaca',
        },
      ], 1]
    }),
  },
}))

vi.mock('@/server/services/cleaner.service', () => ({
  cleanerService: {
    approve: vi.fn(async (id: string, _admin: any, action: string) => ({ id, status: action === 'approve' ? 'approved' : 'rejected' })),
    toggleSuspension: vi.fn(async (id: string) => ({ id, status: 'suspended' })),
  },
}))

vi.mock('@/server/db', () => {
  let bookingFindManyCall = 0
  let disputeFindManyCall = 0

  return {
    db: {
      user: {
        count: vi.fn(async () => 10),
      },
      client: {
        count: vi.fn(async () => 4),
      },
      cleaner: {
        count: vi.fn(async (args?: any) => {
          if (args?.where?.status === 'pending') return 1
          if (args?.where?.status === 'approved') return 2
          if (args?.where?.status === 'rejected') return 0
          if (args?.where?.status === 'suspended') return 0
          if (args?.where?.status === 'approved' && args?.where?.stripeOnboardingComplete) return 1
          return 3
        }),
        findMany: vi.fn(async () => [
          {
            id: 'cleaner_pending_1',
            user: { name: 'Pending Cleaner', email: 'pending@test.local' },
            yearsExperience: 3,
            transportMode: 'own_car',
            cleaningSupplies: 'cleaner_brings',
            standardsCompleted: true,
            quizPassed: true,
            profileImageUrl: null,
            createdAt: new Date('2026-05-01T00:00:00.000Z'),
          },
        ]),
      },
      review: {
        groupBy: vi.fn(async () => [{ cleanerId: 'cleaner_approved_1', _avg: { rating: 4.8 } }]),
      },
      booking: {
        count: vi.fn(async (args?: any) => {
          if (args?.where?.status?.in) return 3
          if (args?.where?.status === 'completed') return 5
          return 8
        }),
        groupBy: vi.fn(async () => [{ cleanerId: 'cleaner_pending_1', _count: { _all: 2 } }]),
        findMany: vi.fn(async (args: any) => {
          bookingFindManyCall += 1
          if (args?.where?.status === 'pending') {
            return [
              {
                id: 'booking_pending_1',
                status: 'pending',
                city: 'Larnaca',
                scheduledStart: new Date(Date.now() + 2 * 60 * 60 * 1000),
                acceptBy: new Date(Date.now() + 60 * 60 * 1000),
                cleaner: { user: { name: 'Cleaner A', email: 'ca@test.local' } },
                client: { user: { name: 'Client A', email: 'cla@test.local' } },
              },
            ]
          }
          if (args?.where?.status === 'accepted' && args?.where?.reauthorizationRequired) {
            return [
              {
                id: 'booking_pay_issue_1',
                status: 'accepted',
                payBy: new Date(Date.now() + 3 * 60 * 60 * 1000),
                client: { user: { name: 'Client Pay', email: 'cp@test.local' } },
              },
            ]
          }
          if (args?.where?.status === 'cancelled') {
            return [
              {
                id: 'booking_cancel_1',
                status: 'cancelled',
                cancellationReason: 'Client changed plan',
                cancelledAt: new Date(),
                updatedAt: new Date(),
              },
            ]
          }
          if (bookingFindManyCall % 2 === 0) {
            return [
              {
                id: 'booking_today_1',
                status: 'confirmed',
                city: 'Larnaca',
                scheduledStart: new Date(),
                cleaner: { user: { name: 'Cleaner Today', email: 'ct@test.local' } },
                client: { user: { name: 'Client Today', email: 'clt@test.local' } },
              },
            ]
          }
          return [
            {
              id: 'booking_tomorrow_1',
              status: 'accepted',
              city: 'Larnaca',
              scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000),
              cleaner: { user: { name: 'Cleaner Tomorrow', email: 'cto@test.local' } },
              client: { user: { name: 'Client Tomorrow', email: 'clto@test.local' } },
            },
          ]
        }),
      },
      dispute: {
        count: vi.fn(async () => 1),
        findMany: vi.fn(async (args: any) => {
          disputeFindManyCall += 1
          if (args?.where?.status?.in) {
            return [
              {
                id: 'dispute_open_1',
                bookingId: 'booking_pending_1',
                status: 'open',
                reason: 'Service issue',
                createdAt: new Date(),
              },
            ]
          }
          return [
            {
              id: 'dispute_noshow_1',
              bookingId: 'booking_cancel_1',
              status: 'under_review',
              reason: 'Cleaner no-show',
              createdAt: new Date(),
            },
          ]
        }),
      },
      payment: {
        aggregate: vi.fn(async () => ({ _sum: { amount: 320, platformFee: 40 } })),
        findMany: vi.fn(async () => [
          {
            id: 'payment_failed_1',
            bookingId: 'booking_pending_1',
            status: 'failed',
            failedAt: new Date(),
            updatedAt: new Date(),
            booking: { client: { user: { name: 'Client A', email: 'cla@test.local' } } },
          },
        ]),
      },
    },
  }
})

describe('F14 Admin routes integration', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.admin as User
    state.listAllArgs = null
  })

  it('IT-ADMIN-01 pending cleaners route returns approval-eligible cleaners', async () => {
    const route = await import('@/app/api/v1/admin/cleaners/pending/route')
    const res = await route.GET(new NextRequest('http://localhost/api/v1/admin/cleaners/pending'), {
      params: Promise.resolve({}),
    } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.length).toBeGreaterThan(0)
  })

  it('IT-ADMIN-02 approve cleaner action updates cleaner status', async () => {
    const route = await import('@/app/api/v1/cleaners/[id]/approve/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/cleaners/cleaner_pending_1/approve', {
        method: 'POST',
        body: JSON.stringify({ action: 'approve' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'cleaner_pending_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('approved')
  })

  it('IT-ADMIN-03 ops queue route returns expected queue buckets with deterministic counts', async () => {
    const route = await import('@/app/api/v1/admin/ops-queues/route')
    const res = await route.GET(new NextRequest('http://localhost/api/v1/admin/ops-queues'), {
      params: Promise.resolve({}),
    } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.pending_cleaner_approvals.count).toBeGreaterThanOrEqual(1)
    expect(body.data.pending_booking_requests.count).toBeGreaterThanOrEqual(1)
    expect(body.data.active_disputes.count).toBeGreaterThanOrEqual(1)
  })

  it('IT-ADMIN-04 admin bookings filters preserve status + pagination arguments', async () => {
    const route = await import('@/app/api/v1/admin/bookings/route')
    const res = await route.GET(
      new NextRequest('http://localhost/api/v1/admin/bookings?status=pending&page=2&page_size=15'),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(state.listAllArgs).toEqual({ status: 'pending', page: 2, pageSize: 15 })
    expect(body.data.total).toBe(1)
  })
})
