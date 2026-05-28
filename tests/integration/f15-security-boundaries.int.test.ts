import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type User = { id: string; role: 'client' | 'cleaner' | 'admin'; email: string }

const seededUsers = vi.hoisted(() => ({
  clientA: { id: '11111111-1111-1111-1111-111111111111', role: 'client', email: 'client-a@test.local' } as User,
  cleanerB: { id: '22222222-2222-2222-2222-222222222222', role: 'cleaner', email: 'cleaner-b@test.local' } as User,
  admin: { id: '33333333-3333-3333-3333-333333333333', role: 'admin', email: 'admin@test.local' } as User,
}))

const state = vi.hoisted(() => ({
  currentUser: seededUsers.clientA as User | null,
  booking: {
    id: 'booking_sec_1',
    status: 'confirmed',
    clientId: 'client_profile_owner',
    cleanerId: 'cleaner_profile_owner',
    client: { userId: seededUsers.clientA.id, user: { email: 'client-a@test.local', name: 'Client A' } },
    cleaner: { userId: seededUsers.cleanerB.id, user: { email: 'cleaner-b@test.local', name: 'Cleaner B' } },
    scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000),
    scheduledEnd: new Date(Date.now() + 26 * 60 * 60 * 1000),
    _count: { messages: 0 },
  } as any,
  clientProfileIdForCurrentUser: 'client_profile_stranger',
  cleanerProfileIdForCurrentUser: 'cleaner_profile_stranger',
  paymentUpdated: 0,
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
    findById: vi.fn(async (id: string) => (id === state.booking.id ? state.booking : null)),
    update: vi.fn(async (_id: string, patch: any) => ({ ...state.booking, ...patch })),
  },
}))

vi.mock('@/server/repositories/client.repo', () => ({
  clientRepo: {
    findByUserId: vi.fn(async () => ({ id: state.clientProfileIdForCurrentUser })),
  },
}))

vi.mock('@/server/repositories/cleaner.repo', () => ({
  cleanerRepo: {
    findByUserId: vi.fn(async () => ({ id: state.cleanerProfileIdForCurrentUser })),
    findById: vi.fn(async () => null),
    update: vi.fn(async () => true),
  },
}))

vi.mock('@/server/services/booking.service', () => {
  class ServiceError extends Error {
    status: number
    constructor(message: string, status = 400) {
      super(message)
      this.status = status
    }
  }

  return {
    ServiceError,
    bookingService: {
      reconcileSingleBookingDeadline: vi.fn(async () => false),
      applyAction: vi.fn(async () => {
        throw new ServiceError('Forbidden', 403)
      }),
    },
  }
})

vi.mock('@/server/services/booking-visibility.service', () => ({
  sanitizeBookingForRole: vi.fn((booking: any) => booking),
}))

vi.mock('@/server/repositories/payment.repo', () => ({
  paymentRepo: {
    findByStripeIntentId: vi.fn(async () => null),
    findByStripeChargeId: vi.fn(async () => null),
    update: vi.fn(async () => {
      state.paymentUpdated += 1
      return null
    }),
  },
}))

vi.mock('@/server/services/payment-authorization.service', () => ({
  paymentAuthorizationService: {
    syncFromPaymentIntent: vi.fn(async () => ({ updated: false })),
  },
}))

vi.mock('@/server/services/loops-email.service', () => ({
  loopsEmailService: {
    sendClientPaymentReceipt: vi.fn(async () => true),
    sendCleanerPayoutNotification: vi.fn(async () => true),
  },
}))

vi.mock('@/server/services/in-app-notification.service', () => ({
  pushInAppNotification: vi.fn(async () => true),
}))

vi.mock('@/server/db', () => ({
  db: {
    user: {
      update: vi.fn(async () => true),
      findMany: vi.fn(async () => [{ id: seededUsers.admin.id }]),
    },
    cleaner: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  },
}))

vi.mock('@/server/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(() => {
        throw new Error('invalid signature')
      }),
    },
    paymentIntents: {
      retrieve: vi.fn(async () => ({ id: 'pi_1', status: 'requires_capture' })),
    },
    refunds: {
      create: vi.fn(async () => ({ id: 're_1' })),
    },
    accounts: {
      retrieve: vi.fn(async () => ({ details_submitted: true, charges_enabled: true, payouts_enabled: true, requirements: { currently_due: [], past_due: [], disabled_reason: null } })),
    },
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.test/profile.jpg' } })),
      })),
    },
  })),
}))

describe('F15 security boundaries integration', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.clientA as User
    state.clientProfileIdForCurrentUser = 'client_profile_stranger'
    state.cleanerProfileIdForCurrentUser = 'cleaner_profile_stranger'
    state.paymentUpdated = 0
  })

  it('IT-SEC-01 client cannot fetch another tenant booking details', async () => {
    const route = await import('@/app/api/v1/bookings/[id]/route')

    const res = await route.GET(
      new NextRequest('http://localhost/api/v1/bookings/booking_sec_1'),
      { params: Promise.resolve({ id: 'booking_sec_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.success).toBe(false)
    expect(body.message).toBe('Forbidden')
  })

  it('IT-SEC-02 cleaner cannot mutate unrelated booking', async () => {
    state.currentUser = seededUsers.cleanerB as User
    state.cleanerProfileIdForCurrentUser = 'cleaner_profile_stranger'

    const route = await import('@/app/api/v1/bookings/[id]/action/route')
    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/bookings/booking_sec_1/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'accept' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'booking_sec_1' }) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.success).toBe(false)
  })

  it('IT-SEC-03 invalid webhook signature is rejected with no payment mutation', async () => {
    const route = await import('@/app/api/v1/payments/webhook/route')

    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/payments/webhook', {
        method: 'POST',
        body: JSON.stringify({ id: 'evt_bad' }),
        headers: { 'stripe-signature': 'sig_invalid' },
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Invalid signature')
    expect(state.paymentUpdated).toBe(0)
  })

  it('IT-SEC-04 upload route enforces mime/signature constraints', async () => {
    const route = await import('@/app/api/v1/upload/profile-image/route')

    const form = new FormData()
    const badFile = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'archive.zip', {
      type: 'application/zip',
    })
    form.set('file', badFile)

    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/upload/profile-image', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(String(body.message).toLowerCase()).toContain('jpeg')
  })
})
