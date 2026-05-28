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
  listCalls: 0,
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
    requireAdmin: (handler: any) => async (req: NextRequest, ctx: any) => {
      if (!state.currentUser) return unauthorized()
      if (state.currentUser.role !== 'admin') return forbidden()
      return handler(req, ctx, state.currentUser)
    },
  }
})

vi.mock('@/server/repositories/user.repo', () => ({
  userRepo: {
    list: vi.fn(async () => {
      state.listCalls += 1
      return [[seededUsers.client], 1]
    }),
  },
}))

describe('F01 Auth + RBAC integration', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.client as any
    state.listCalls = 0
  })

  it('IT-AUTH-01 GET /api/v1/auth/me returns current user for valid session', async () => {
    const route = await import('@/app/api/v1/auth/me/route')
    const res = await route.GET(new NextRequest('http://localhost/api/v1/auth/me'), { params: Promise.resolve({}) } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.id).toBe(seededUsers.client.id)
    expect(body.data.role).toBe('client')
  })

  it('IT-AUTH-02 protected routes return 401 for missing auth', async () => {
    state.currentUser = null
    const route = await import('@/app/api/v1/auth/me/route')
    const res = await route.GET(new NextRequest('http://localhost/api/v1/auth/me'), { params: Promise.resolve({}) } as any)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.message).toBe('Unauthorized')
  })

  it('IT-AUTH-03 client token cannot access admin-only API', async () => {
    state.currentUser = seededUsers.client as any
    const route = await import('@/app/api/v1/admin/users/route')
    const res = await route.GET(new NextRequest('http://localhost/api/v1/admin/users?page=1&page_size=20'), { params: Promise.resolve({}) } as any)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.success).toBe(false)
    expect(body.message).toBe('Forbidden')
    expect(state.listCalls).toBe(0)
  })

  it('IT-AUTH-04 admin token can access admin routes', async () => {
    state.currentUser = seededUsers.admin as any
    const route = await import('@/app/api/v1/admin/users/route')
    const res = await route.GET(new NextRequest('http://localhost/api/v1/admin/users?page=1&page_size=20'), { params: Promise.resolve({}) } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.total).toBe(1)
    expect(state.listCalls).toBe(1)
  })
})
