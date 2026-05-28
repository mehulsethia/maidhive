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

const state = vi.hoisted(() => ({
  currentUser: seededUsers.client as any | null,
  cleanerRate: 20,
  createdBookings: [] as any[],
}))

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

vi.mock('@/server/repositories/cleaner.repo', () => ({
  cleanerRepo: {
    findById: vi.fn(async (id: string) => {
      if (id !== 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') return null
      return { id, hourlyRate: state.cleanerRate }
    }),
  },
}))

vi.mock('@/server/services/booking.service', () => {
  class ServiceError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  }

  return {
    ServiceError,
    bookingService: {
      previewPrice: vi.fn((hourlyRate: number, durationHours: number, platformFeePct = 10) => {
        const subtotal = hourlyRate * durationHours
        const platformFee = Number((subtotal * (platformFeePct / 100)).toFixed(2))
        const total = Number((subtotal + platformFee).toFixed(2))
        return {
          hourly_rate: hourlyRate,
          duration_hours: durationHours,
          subtotal: Number(subtotal.toFixed(2)),
          platform_fee_pct: platformFeePct,
          platform_fee: platformFee,
          cleaner_payout: Number(subtotal.toFixed(2)),
          total_amount: total,
        }
      }),
      create: vi.fn(async (_user: any, data: any) => {
        const hourly = state.cleanerRate
        const subtotal = Number((hourly * data.duration_hours).toFixed(2))
        const platformFee = Number((subtotal * 0.1).toFixed(2))
        const booking = {
          id: `booking_${state.createdBookings.length + 1}`,
          cleanerId: data.cleaner_id,
          status: 'draft',
          hourlyRate: hourly,
          subtotal,
          platformFeePct: 10,
          platformFee,
          cleanerPayout: subtotal,
          totalAmount: Number((subtotal + platformFee).toFixed(2)),
          scheduledStart: data.scheduled_start,
        }
        state.createdBookings.push(booking)
        return booking
      }),
    },
  }
})

vi.mock('@/server/repositories/booking.repo', () => ({
  bookingRepo: {
    findByClient: vi.fn(async () => [[], 0]),
    findByCleaner: vi.fn(async () => [[], 0]),
  },
}))

vi.mock('@/server/repositories/client.repo', () => ({
  clientRepo: {
    findByUserId: vi.fn(async () => ({ id: 'client_profile_1', userId: seededUsers.client.id })),
    create: vi.fn(async () => ({ id: 'client_profile_1', userId: seededUsers.client.id })),
  },
}))

vi.mock('@/server/services/booking-visibility.service', () => ({
  sanitizeBookingsForRole: (rows: any[]) => rows,
}))

function validCreateBookingPayload() {
  return {
    cleaner_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    service_type: 'standard',
    special_instructions: 'Please focus on kitchen and living room.',
    address: '1 Test Street',
    city: 'Larnaca',
    postcode: '6020',
    country: 'CY',
    apartment_details: 'Flat 2',
    access_notes: 'Buzz 12',
    scheduled_start: '2026-06-10T09:00:00.000Z',
    duration_hours: 3,
  }
}

describe('F05 Pricing + booking creation integration', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.client as any
    state.cleanerRate = 20
    state.createdBookings = []
  })

  it('IT-PRICE-01 POST /bookings/preview-price returns expected math', async () => {
    const route = await import('@/app/api/v1/bookings/preview-price/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/bookings/preview-price', {
        method: 'POST',
        body: JSON.stringify({
          cleaner_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          duration_hours: 3,
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.hourly_rate).toBe(20)
    expect(body.data.subtotal).toBe(60)
    expect(body.data.total_amount).toBe(66)
  })

  it('IT-PRICE-02 POST /bookings stores pricing snapshot fields', async () => {
    const route = await import('@/app/api/v1/bookings/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/bookings', {
        method: 'POST',
        body: JSON.stringify(validCreateBookingPayload()),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.hourly_rate).toBe(20)
    expect(body.data.subtotal).toBe(60)
    expect(body.data.platform_fee).toBe(6)
    expect(body.data.total_amount).toBe(66)
  })

  it('IT-PRICE-03 cleaner rate change does not mutate existing booking totals', async () => {
    const route = await import('@/app/api/v1/bookings/route')

    await route.POST(
      new NextRequest('http://localhost/api/v1/bookings', {
        method: 'POST',
        body: JSON.stringify(validCreateBookingPayload()),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) } as any,
    )
    const first = state.createdBookings[0]

    state.cleanerRate = 35
    await route.POST(
      new NextRequest('http://localhost/api/v1/bookings', {
        method: 'POST',
        body: JSON.stringify(validCreateBookingPayload()),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) } as any,
    )
    const second = state.createdBookings[1]

    expect(first.hourlyRate).toBe(20)
    expect(first.totalAmount).toBe(66)
    expect(second.hourlyRate).toBe(35)
    expect(second.totalAmount).toBe(115.5)
  })

  it('IT-PRICE-04 invalid location/window payload is rejected', async () => {
    const route = await import('@/app/api/v1/bookings/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/bookings', {
        method: 'POST',
        body: JSON.stringify({ cleaner_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.success).toBe(false)
  })
})
