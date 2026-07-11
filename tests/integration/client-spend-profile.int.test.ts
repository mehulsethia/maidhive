import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/server/auth', () => ({
  requireClient: (handler: any) => (req: NextRequest, ctx: any) => handler(req, ctx, { id: 'client_user' }),
  getAuthSessionUser: vi.fn(async () => ({ email_confirmed_at: '2026-06-01T00:00:00.000Z' })),
}))

vi.mock('@/server/repositories/client.repo', () => ({
  clientRepo: {
    findByUserId: vi.fn(async () => ({
      id: 'client_profile',
      userId: 'client_user',
      user: { id: 'client_user', name: 'Client User' },
    })),
    create: vi.fn(),
  },
}))

vi.mock('@/server/repositories/user.repo', () => ({ userRepo: { update: vi.fn() } }))

vi.mock('@/server/db', () => ({
  db: {
    payment: {
      findMany: vi.fn(async () => [
        { status: 'transferred', amount: 35.2, refundAmount: null },
        { status: 'captured', amount: 35.2, refundAmount: 30.2 },
        { status: 'transferred', amount: 26.4, refundAmount: 8 },
        { status: 'partially_refunded', amount: 80, refundAmount: 20 },
      ]),
    },
  },
}))

describe('client profile spend integration', () => {
  it('returns net lifetime captured spend including cancellation and no-show charges', async () => {
    const route = await import('@/app/api/v1/clients/me/route')
    const response = await route.GET(
      new NextRequest('http://localhost/api/v1/clients/me'),
      { params: Promise.resolve({}) } as any,
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.total_spent).toBe(118.6)
  })
})
