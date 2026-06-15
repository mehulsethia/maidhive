import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type User = { id: string; email: string; name: string; role: 'client' | 'cleaner' | 'admin'; phone?: string | null }

const seededUsers = vi.hoisted(() => ({
  client: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'client@test.local',
    name: 'Client User',
    role: 'client',
    phone: null,
  } as User,
  cleaner: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'cleaner@test.local',
    name: 'Cleaner User',
    role: 'cleaner',
    phone: null,
  } as User,
  admin: {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'admin@test.local',
    name: 'Admin User',
    role: 'admin',
    phone: null,
  } as User,
}))

const state = vi.hoisted(() => ({
  currentUser: seededUsers.client as User | null,
  clientExists: false,
  createdClients: 0,
  cleanerExists: false,
  createdCleaners: 0,
  notifications: [] as any[],
  readCalls: 0,
  readAllCalls: 0,
  archiveCalls: 0,
  deleteCalls: 0,
  markReadForUsersCalls: 0,
  markAllReadForUsersCalls: 0,
  setArchivedForUsersCalls: 0,
  emailShouldFail: false,
  clientAccountEmails: [] as any[],
  cleanerSignupEmails: [] as any[],
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

vi.mock('@/server/repositories/notification.repo', () => ({
  notificationRepo: {
    findByUserId: vi.fn(async (_userId: string, page: number, pageSize: number) => [[
      { id: 'notif_1', userId: seededUsers.client.id, type: 'booking_request', data: { booking_id: 'booking_1' }, isRead: false },
    ], 1]),
    findByUserIds: vi.fn(async (_userIds: string[], page: number, pageSize: number) => [[
      { id: 'notif_admin_1', userId: seededUsers.admin.id, type: 'dispute_raised', data: { dispute_id: 'd_1' }, isRead: false },
    ], 1]),
    create: vi.fn(async (payload: any) => {
      state.notifications.push(payload)
      return payload
    }),
    markRead: vi.fn(async () => {
      state.readCalls += 1
      return { count: 1 }
    }),
    markAllRead: vi.fn(async () => {
      state.readAllCalls += 1
      return { count: 1 }
    }),
    setArchived: vi.fn(async () => {
      state.archiveCalls += 1
      return { id: 'notif_1' }
    }),
    delete: vi.fn(async () => {
      state.deleteCalls += 1
      return { count: 1 }
    }),
    markReadForUsers: vi.fn(async () => {
      state.markReadForUsersCalls += 1
      return { count: 1 }
    }),
    markAllReadForUsers: vi.fn(async () => {
      state.markAllReadForUsersCalls += 1
      return { count: 1 }
    }),
    setArchivedForUsers: vi.fn(async () => {
      state.setArchivedForUsersCalls += 1
      return { id: 'notif_admin_1' }
    }),
    deleteForUsers: vi.fn(async () => ({ count: 1 })),
  },
}))

vi.mock('@/server/db', () => ({
  db: {
    user: {
      findMany: vi.fn(async () => [{ id: seededUsers.admin.id }]),
    },
  },
}))

vi.mock('@/server/repositories/client.repo', () => ({
  clientRepo: {
    findByUserId: vi.fn(async () => (state.clientExists ? { id: 'client_profile_1' } : null)),
    create: vi.fn(async () => {
      state.clientExists = true
      state.createdClients += 1
      return { id: 'client_profile_1', userId: seededUsers.client.id }
    }),
  },
}))

vi.mock('@/server/repositories/cleaner.repo', () => ({
  cleanerRepo: {
    findByUserId: vi.fn(async () => (state.cleanerExists ? { id: 'cleaner_profile_1' } : null)),
    create: vi.fn(async () => {
      state.cleanerExists = true
      state.createdCleaners += 1
      return { id: 'cleaner_profile_1', userId: state.currentUser?.id }
    }),
    update: vi.fn(async () => null),
  },
}))

vi.mock('@/server/repositories/user.repo', () => ({
  userRepo: {
    update: vi.fn(async (_id: string, patch: any) => ({ ...seededUsers.client, ...patch })),
    findById: vi.fn(async (id: string) => ({ ...seededUsers.client, id })),
  },
}))

vi.mock('@/server/services/in-app-notification.service', () => ({
  pushInAppNotification: vi.fn(async (payload: any) => {
    state.notifications.push(payload)
    return true
  }),
}))

vi.mock('@/server/services/loops-email.service', () => ({
  loopsEmailService: {
    sendClientAccountCreated: vi.fn(async (payload: any) => {
      if (state.emailShouldFail) throw new Error('loops down')
      state.clientAccountEmails.push(payload)
      return true
    }),
    sendCleanerSignup: vi.fn(async (payload: any) => {
      state.cleanerSignupEmails.push(payload)
      return true
    }),
  },
}))

describe('F13 notifications integration', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.client as User
    state.clientExists = false
    state.createdClients = 0
    state.cleanerExists = false
    state.createdCleaners = 0
    state.notifications = []
    state.readCalls = 0
    state.readAllCalls = 0
    state.archiveCalls = 0
    state.deleteCalls = 0
    state.markReadForUsersCalls = 0
    state.markAllReadForUsersCalls = 0
    state.setArchivedForUsersCalls = 0
    state.emailShouldFail = false
    state.clientAccountEmails = []
    state.cleanerSignupEmails = []
  })

  it('IT-NOTIF-01 first client auth sync emits account_created notification and creates profile', async () => {
    const route = await import('@/app/api/v1/auth/sync/route')

    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/auth/sync', {
        method: 'POST',
        body: JSON.stringify({ name: 'Client User' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(state.createdClients).toBe(1)
    expect(state.notifications.some((item) => item.type === 'account_created')).toBe(true)
    expect(state.clientAccountEmails).toEqual([
      expect.objectContaining({
        email: seededUsers.client.email,
        fullName: seededUsers.client.name,
      }),
    ])
    expect(state.cleanerSignupEmails).toHaveLength(0)
  })

  it('IT-NOTIF-01B first cleaner auth sync emits signup email and creates profile', async () => {
    state.currentUser = seededUsers.cleaner
    const route = await import('@/app/api/v1/auth/sync/route')

    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/auth/sync', {
        method: 'POST',
        body: JSON.stringify({ name: 'Cleaner User' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(state.createdCleaners).toBe(1)
    expect(state.cleanerSignupEmails).toEqual([
      expect.objectContaining({
        email: 'cleaner@test.local',
        fullName: 'Cleaner User',
      }),
    ])
    expect(state.clientAccountEmails).toHaveLength(0)
  })

  it('IT-NOTIF-02 read/read-all/archive routes update notification state for regular and admin users', async () => {
    const listRoute = await import('@/app/api/v1/notifications/route')
    const readRoute = await import('@/app/api/v1/notifications/[id]/read/route')
    const readAllRoute = await import('@/app/api/v1/notifications/read-all/route')
    const archiveRoute = await import('@/app/api/v1/notifications/[id]/archive/route')

    const listRes = await listRoute.GET(
      new NextRequest('http://localhost/api/v1/notifications?page=1&page_size=20'),
      { params: Promise.resolve({}) } as any,
    )
    expect(listRes.status).toBe(200)

    const readRes = await readRoute.PATCH(
      new NextRequest('http://localhost/api/v1/notifications/notif_1/read', { method: 'PATCH' }),
      { params: Promise.resolve({ id: 'notif_1' }) } as any,
    )
    const readAllRes = await readAllRoute.PATCH(
      new NextRequest('http://localhost/api/v1/notifications/read-all', { method: 'PATCH' }),
      { params: Promise.resolve({}) } as any,
    )
    const archiveRes = await archiveRoute.PATCH(
      new NextRequest('http://localhost/api/v1/notifications/notif_1/archive', {
        method: 'PATCH',
        body: JSON.stringify({ archived: true }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'notif_1' }) } as any,
    )

    expect(readRes.status).toBe(200)
    expect(readAllRes.status).toBe(200)
    expect(archiveRes.status).toBe(200)
    expect(state.readCalls).toBe(1)
    expect(state.readAllCalls).toBe(1)
    expect(state.archiveCalls).toBe(1)

    state.currentUser = seededUsers.admin as User
    const adminReadRes = await readRoute.PATCH(
      new NextRequest('http://localhost/api/v1/notifications/notif_admin_1/read', { method: 'PATCH' }),
      { params: Promise.resolve({ id: 'notif_admin_1' }) } as any,
    )
    expect(adminReadRes.status).toBe(200)
    expect(state.markReadForUsersCalls).toBe(1)
  })

  it('IT-NOTIF-03 notification email send failures do not block auth sync success path', async () => {
    state.emailShouldFail = true
    const route = await import('@/app/api/v1/auth/sync/route')

    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/auth/sync', {
        method: 'POST',
        body: JSON.stringify({ name: 'Client User' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(state.createdClients).toBe(1)
  })
})
