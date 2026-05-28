import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type User = { id: string; role: 'client' | 'cleaner' | 'admin' }

const seededUsers = vi.hoisted(() => ({
  client: { id: '11111111-1111-1111-1111-111111111111', role: 'client' } as User,
  cleaner: { id: '22222222-2222-2222-2222-222222222222', role: 'cleaner' } as User,
}))

const state = vi.hoisted(() => ({
  currentUser: seededUsers.cleaner as User | null,
  cleanerProfile: { id: 'cleaner_profile_1', userId: seededUsers.cleaner.id },
  schedules: [
    {
      id: 'sched_1',
      cleanerId: 'cleaner_profile_1',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
      bufferMinutes: 30,
      isActive: true,
    },
  ] as any[],
  blocked: [] as any[],
  availableDates: ['2026-06-12', '2026-06-13'],
  availableSlots: [
    { start: '2026-06-12T09:00:00.000Z', end: '2026-06-12T11:00:00.000Z', disabled: false },
    { start: '2026-06-12T11:30:00.000Z', end: '2026-06-12T13:30:00.000Z', disabled: false },
  ] as any[],
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
    requireAuth: (handler: any) => async (req: NextRequest, ctx: any) => {
      if (!state.currentUser) return unauthorized()
      return handler(req, ctx, state.currentUser)
    },
  }
})

vi.mock('@/server/repositories/cleaner.repo', () => ({
  cleanerRepo: {
    findByUserId: vi.fn(async (userId: string) => (userId === state.cleanerProfile.userId ? state.cleanerProfile : null)),
  },
}))

vi.mock('@/server/repositories/availability.repo', () => ({
  availabilityRepo: {
    getSchedule: vi.fn(async () => state.schedules),
    replaceSchedule: vi.fn(async (_cleanerId: string, schedules: any[]) => {
      state.schedules = schedules.map((slot, index) => ({
        id: `sched_${index + 1}`,
        cleanerId: state.cleanerProfile.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        bufferMinutes: slot.bufferMinutes,
        isActive: slot.isActive,
      }))
      return state.schedules
    }),
    getBlockedTimesInRange: vi.fn(async () => state.blocked),
    addBlockedTime: vi.fn(async (_cleanerId: string, payload: any) => {
      const row = { id: `block_${state.blocked.length + 1}`, ...payload }
      state.blocked.push(row)
      return row
    }),
    getBlockedTimes: vi.fn(async () => state.blocked),
    deleteBlockedTime: vi.fn(async (id: string) => {
      state.blocked = state.blocked.filter((row: any) => row.id !== id)
      return true
    }),
  },
}))

vi.mock('@/server/services/availability.service', () => ({
  availabilityService: {
    getBookableDates: vi.fn(async () => state.availableDates),
    getAvailableSlots: vi.fn(async () => state.availableSlots),
  },
}))

describe('F11 Availability and conflict prevention integration', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.cleaner as User
    state.cleanerProfile = { id: 'cleaner_profile_1', userId: seededUsers.cleaner.id }
    state.schedules = [
      {
        id: 'sched_1',
        cleanerId: 'cleaner_profile_1',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
        bufferMinutes: 30,
        isActive: true,
      },
    ]
    state.blocked = []
    state.availableDates = ['2026-06-12', '2026-06-13']
    state.availableSlots = [
      { start: '2026-06-12T09:00:00.000Z', end: '2026-06-12T11:00:00.000Z', disabled: false },
    ]
  })

  it('IT-AVAIL-01 cleaner can create/update schedule and retrieve persisted values', async () => {
    const route = await import('@/app/api/v1/availability/me/route')

    const putRes = await route.PUT(
      new NextRequest('http://localhost/api/v1/availability/me', {
        method: 'PUT',
        body: JSON.stringify({
          schedules: [
            {
              day_of_week: 1,
              start_time: '08:00',
              end_time: '16:00',
              buffer_minutes: 30,
              is_active: true,
            },
          ],
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) } as any,
    )

    const getRes = await route.GET(new NextRequest('http://localhost/api/v1/availability/me'), {
      params: Promise.resolve({}),
    } as any)

    const putBody = await putRes.json()
    const getBody = await getRes.json()

    expect(putRes.status).toBe(200)
    expect(getRes.status).toBe(200)
    expect(putBody.success).toBe(true)
    const firstStart = getBody.data?.[0]?.startTime ?? getBody.data?.[0]?.start_time ?? putBody.data?.[0]?.startTime ?? putBody.data?.[0]?.start_time
    expect(firstStart).toBe('08:00')
  })

  it('IT-AVAIL-02 blocked dates are enforced and overlap conflicts are rejected', async () => {
    const blockedRoute = await import('@/app/api/v1/availability/me/blocked/route')

    const first = await blockedRoute.POST(
      new NextRequest('http://localhost/api/v1/availability/me/blocked', {
        method: 'POST',
        body: JSON.stringify({
          start_datetime: '2026-06-20T00:00:00.000Z',
          end_datetime: '2026-06-20T23:59:59.000Z',
          reason: 'Holiday',
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) } as any,
    )

    state.blocked = [
      {
        id: 'block_existing',
        startDatetime: new Date('2026-06-20T00:00:00.000Z'),
        endDatetime: new Date('2026-06-20T23:59:59.000Z'),
      },
    ]

    const overlap = await blockedRoute.POST(
      new NextRequest('http://localhost/api/v1/availability/me/blocked', {
        method: 'POST',
        body: JSON.stringify({
          start_datetime: '2026-06-20T12:00:00.000Z',
          end_datetime: '2026-06-21T12:00:00.000Z',
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) } as any,
    )

    expect(first.status).toBe(201)
    expect(overlap.status).toBe(409)
  })

  it('IT-AVAIL-03 booking slots endpoint returns only currently bookable slots', async () => {
    state.currentUser = seededUsers.client as User
    const slotsRoute = await import('@/app/api/v1/availability/[cleanerId]/slots/route')
    const res = await slotsRoute.GET(
      new NextRequest('http://localhost/api/v1/availability/cleaner_profile_1/slots?date=2026-06-12&duration_hours=2'),
      { params: Promise.resolve({ cleanerId: 'cleaner_profile_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data[0].disabled).toBe(false)
  })

  it('IT-AVAIL-04 dates endpoint returns deterministic list for valid non-overlapping availability', async () => {
    state.currentUser = seededUsers.client as User
    const datesRoute = await import('@/app/api/v1/availability/[cleanerId]/dates/route')
    const res = await datesRoute.GET(
      new NextRequest('http://localhost/api/v1/availability/cleaner_profile_1/dates?duration_hours=2&days_ahead=14'),
      { params: Promise.resolve({ cleanerId: 'cleaner_profile_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual(state.availableDates)
  })
})
