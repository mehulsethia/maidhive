import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type User = { id: string; role: 'client' | 'cleaner' | 'admin' }

const seededUsers = vi.hoisted(() => ({
  client: { id: '11111111-1111-1111-1111-111111111111', role: 'client' } as User,
  cleaner: { id: '22222222-2222-2222-2222-222222222222', role: 'cleaner' } as User,
}))

const state = vi.hoisted(() => ({
  currentUser: seededUsers.client as User | null,
  cleanerProfile: { id: 'cleaner_profile_1', userId: seededUsers.cleaner.id, profileComplete: false, status: 'pending' },
  clientProfile: { id: 'client_profile_1', userId: seededUsers.client.id },
  uploadCalls: 0,
  updatedClientMeta: null as any,
  updatedCleanerMeta: null as any,
}))

vi.mock('@/server/auth', () => {
  const unauthorized = () => new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 })
  const forbidden = () => new Response(JSON.stringify({ success: false, message: 'Forbidden' }), { status: 403 })

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
    requireCleaner: (handler: any) => async (req: NextRequest, ctx: any) => {
      if (!state.currentUser) return unauthorized()
      if (state.currentUser.role !== 'cleaner') return forbidden()
      return handler(req, ctx, state.currentUser)
    },
  }
})

vi.mock('@/server/repositories/client.repo', () => ({
  clientRepo: {
    findByUserId: vi.fn(async () => state.clientProfile),
    update: vi.fn(async (_id: string, patch: any) => {
      state.updatedClientMeta = patch
      return true
    }),
  },
}))

vi.mock('@/server/repositories/cleaner.repo', () => ({
  cleanerRepo: {
    findByUserId: vi.fn(async () => state.cleanerProfile),
    update: vi.fn(async (_id: string, patch: any) => {
      state.updatedCleanerMeta = patch
      return true
    }),
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      getBucket: vi.fn(async () => ({ data: { name: 'bucket' }, error: null })),
      createBucket: vi.fn(async () => ({ error: null })),
      from: vi.fn(() => ({
        upload: vi.fn(async () => {
          state.uploadCalls += 1
          return { error: null }
        }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.test/uploaded-file' } })),
      })),
    },
  })),
}))

describe('F18 upload routes integration', () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = seededUsers.client as User
    state.cleanerProfile = { id: 'cleaner_profile_1', userId: seededUsers.cleaner.id, profileComplete: false, status: 'pending' }
    state.clientProfile = { id: 'client_profile_1', userId: seededUsers.client.id }
    state.uploadCalls = 0
    state.updatedClientMeta = null
    state.updatedCleanerMeta = null
  })

  it('IT-UPLOAD-01 authenticated client ID upload stores metadata', async () => {
    const route = await import('@/app/api/v1/upload/client-id-document/route')
    const form = new FormData()
    const pdfFile = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], 'id.pdf', {
      type: 'application/pdf',
    })
    form.set('file', pdfFile)

    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/upload/client-id-document', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(state.uploadCalls).toBe(1)
    expect(state.updatedClientMeta.idFileName).toBe('id.pdf')
  })

  it('IT-UPLOAD-02 unauthorized booking photo upload request is rejected', async () => {
    state.currentUser = null
    const route = await import('@/app/api/v1/upload/booking-photos/route')
    const form = new FormData()
    form.set('file', new File([new Uint8Array([0xff, 0xd8, 0xff])], 'job.jpg', { type: 'image/jpeg' }))

    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/upload/booking-photos', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
  })

  it('IT-UPLOAD-03 cleaner KYC upload enforces lock when profile is complete and not rejected', async () => {
    state.currentUser = seededUsers.cleaner as User
    state.cleanerProfile = {
      id: 'cleaner_profile_1',
      userId: seededUsers.cleaner.id,
      profileComplete: true,
      status: 'approved',
    }

    const route = await import('@/app/api/v1/upload/kyc-document/route')
    const form = new FormData()
    form.set('file', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'kyc.pdf', { type: 'application/pdf' }))

    const res = await route.POST(
      new NextRequest('http://localhost/api/v1/upload/kyc-document', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({}) } as any,
    )
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.success).toBe(false)
    expect(String(body.message).toLowerCase()).toContain('cannot be changed')
  })
})
