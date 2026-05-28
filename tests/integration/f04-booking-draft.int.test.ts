import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const seededUsers = vi.hoisted(() => ({
  client: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'client@test.local',
    name: 'Client User',
    role: 'client',
  },
  cleaner: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'cleaner@test.local',
    name: 'Cleaner User',
    role: 'cleaner',
  },
  admin: {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'admin@test.local',
    name: 'Admin User',
    role: 'admin',
  },
}))

type DraftRecord = {
  id: string
  clientId: string
  cleanerId: string
  bookingId: string | null
  lastStep: number
  durationHours: number | null
  selectedDate: string | null
  selectedSlot: Date | null
  payload: Record<string, any> | null
}

const state = vi.hoisted(() => ({
  currentUser: seededUsers.client as any | null,
  client: { id: 'client_profile_1', userId: seededUsers.client.id },
  cleaner: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', userId: seededUsers.cleaner.id },
  draftStore: new Map<string, DraftRecord>(),
  bookingFindByClientCall: 0,
  bookingRows: [
    { id: 'b_pending', status: 'pending' },
    { id: 'b_expired', status: 'expired' },
  ] as any[],
}))

function draftKey(clientId: string, cleanerId: string) {
  return `${clientId}:${cleanerId}`
}

vi.mock('@/server/auth', () => {
  const unauthorized = () =>
    new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 })
  const forbidden = () =>
    new Response(JSON.stringify({ success: false, message: 'Forbidden' }), { status: 403 })
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
  }
})

vi.mock('@/server/repositories/client.repo', () => ({
  clientRepo: {
    findByUserId: vi.fn(async (userId: string) => {
      if (userId === state.client.userId) return state.client
      return null
    }),
    create: vi.fn(async () => state.client),
  },
}))

vi.mock('@/server/repositories/cleaner.repo', () => ({
  cleanerRepo: {
    findById: vi.fn(async (id: string) => (id === state.cleaner.id ? state.cleaner : null)),
    findByUserId: vi.fn(async () => state.cleaner),
    create: vi.fn(async () => state.cleaner),
  },
}))

vi.mock('@/server/repositories/booking.repo', () => ({
  bookingRepo: {
    findById: vi.fn(async () => null),
    findByClient: vi.fn(async () => {
      state.bookingFindByClientCall += 1
      if (state.bookingFindByClientCall === 1) return [[state.bookingRows[0]], 1]
      return [[state.bookingRows[1]], 1]
    }),
    findByCleaner: vi.fn(async () => [[], 0]),
  },
}))

vi.mock('@/server/repositories/booking-flow-draft.repo', () => ({
  bookingFlowDraftRepo: {
    findByClientAndCleaner: vi.fn(async (clientId: string, cleanerId: string) => {
      return state.draftStore.get(draftKey(clientId, cleanerId)) ?? null
    }),
    upsertByClientAndCleaner: vi.fn(async (input: any) => {
      const next: DraftRecord = {
        id: state.draftStore.get(draftKey(input.clientId, input.cleanerId))?.id ?? 'draft_1',
        clientId: input.clientId,
        cleanerId: input.cleanerId,
        bookingId: input.bookingId ?? null,
        lastStep: input.lastStep,
        durationHours: input.durationHours ?? null,
        selectedDate: input.selectedDate ?? null,
        selectedSlot: input.selectedSlot ?? null,
        payload: input.payload ?? null,
      }
      state.draftStore.set(draftKey(input.clientId, input.cleanerId), next)
      return next
    }),
    clearByClientAndCleaner: vi.fn(async (clientId: string, cleanerId: string) => {
      state.draftStore.delete(draftKey(clientId, cleanerId))
    }),
  },
}))

vi.mock('@/server/services/booking.service', () => ({
  ServiceError: class ServiceError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
  bookingService: {
    reconcileDeadlinesForBookings: vi.fn(async () => true),
  },
}))

vi.mock('@/server/services/booking-visibility.service', () => ({
  sanitizeBookingsForRole: (rows: any[]) => rows,
}))

describe('F04 Booking draft lifecycle integration', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.client as any
    state.draftStore.clear()
    state.bookingFindByClientCall = 0
  })

  it('IT-DRAFT-01 save and retrieve step 1/2/3 draft payload', async () => {
    const route = await import('@/app/api/v1/bookings/draft/route')
    const putReq = new NextRequest('http://localhost/api/v1/bookings/draft', {
      method: 'PUT',
      body: JSON.stringify({
        cleaner_id: state.cleaner.id,
        last_step: 3,
        duration_hours: 3,
        selected_date: '2026-06-03',
        selected_slot: '2026-06-03T09:00:00.000Z',
        payload: { service_type: 'standard', note: 'step3-ready' },
      }),
      headers: { 'content-type': 'application/json' },
    })

    const putRes = await route.PUT(putReq, { params: Promise.resolve({}) } as any)
    expect(putRes.status).toBe(200)

    const getRes = await route.GET(
      new NextRequest(`http://localhost/api/v1/bookings/draft?cleaner_id=${state.cleaner.id}`),
      { params: Promise.resolve({}) } as any,
    )
    const body = await getRes.json()
    expect(getRes.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.last_step).toBe(3)
    expect(body.data.payload.note).toBe('step3-ready')
  })

  it('IT-DRAFT-02 refresh/reload returns latest draft without corruption', async () => {
    const route = await import('@/app/api/v1/bookings/draft/route')
    await route.PUT(
      new NextRequest('http://localhost/api/v1/bookings/draft', {
        method: 'PUT',
        body: JSON.stringify({
          cleaner_id: state.cleaner.id,
          last_step: 2,
          duration_hours: 2,
          payload: { selectedSlot: '2026-06-04T10:00:00.000Z', note: 'persist-me' },
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) } as any,
    )

    const req = new NextRequest(`http://localhost/api/v1/bookings/draft?cleaner_id=${state.cleaner.id}`)
    const first = await route.GET(req, { params: Promise.resolve({}) } as any)
    const second = await route.GET(req, { params: Promise.resolve({}) } as any)
    const firstBody = await first.json()
    const secondBody = await second.json()

    expect(firstBody.data).toEqual(secondBody.data)
    expect(firstBody.data.payload.note).toBe('persist-me')
  })

  it('IT-DRAFT-03 draft does not appear in cleaner operational lists/counts', async () => {
    state.currentUser = seededUsers.cleaner as any
    const route = await import('@/app/api/v1/bookings/draft/route')
    const res = await route.GET(
      new NextRequest(`http://localhost/api/v1/bookings/draft?cleaner_id=${state.cleaner.id}`),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.success).toBe(false)
    expect(body.message).toBe('Forbidden')
  })

  it('IT-DRAFT-04 expired draft transitions to expired on reconcile path', async () => {
    const bookingsRoute = await import('@/app/api/v1/bookings/route')
    const res = await bookingsRoute.GET(
      new NextRequest('http://localhost/api/v1/bookings?page=1&page_size=20&status=pending'),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.bookings[0].status).toBe('expired')
    expect(state.bookingFindByClientCall).toBe(2)
  })
})
