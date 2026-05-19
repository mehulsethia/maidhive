import jwt from 'jsonwebtoken'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { db } from './db'
import type { User } from '@prisma/client'

export type RouteContext = { params: Promise<Record<string, string>> }
type AuthedHandler = (req: NextRequest, ctx: RouteContext, user: User) => Promise<NextResponse>
type Handler = (req: NextRequest, ctx: RouteContext) => Promise<NextResponse>

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '').trim()
  return token || null
}

function createRequestSupabaseClient(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {
          /* no-op - middleware handles cookie refresh */
        },
      },
    },
  )
}

// Request-scoped cache so the same supabase.auth.getUser() roundtrip isn't
// repeated across requireAuth + downstream handlers (e.g. /clients/me).
type CachedSessionUser = Awaited<ReturnType<ReturnType<typeof createRequestSupabaseClient>['auth']['getUser']>>['data']['user']
const sessionUserByRequest = new WeakMap<NextRequest, Promise<CachedSessionUser | null>>()

export function getAuthSessionUser(req: NextRequest): Promise<CachedSessionUser | null> {
  const cached = sessionUserByRequest.get(req)
  if (cached) return cached
  const promise = (async () => {
    try {
      const supabase = createRequestSupabaseClient(req)
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) return null
      return data.user
    } catch {
      return null
    }
  })()
  sessionUserByRequest.set(req, promise)
  return promise
}

export async function getAuthUser(req: NextRequest): Promise<User | null> {
  const token = getBearerToken(req)

  // 1) Primary path: Bearer token verification (for explicit API auth headers).
  if (token && process.env.SUPABASE_JWT_SECRET) {
    try {
      const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET, {
        audience: 'authenticated',
      }) as { sub: string }

      const user = await db.user.findUnique({ where: { id: payload.sub } })
      if (user) {
        if (!user.isActive || user.deletedAt) return null
        return user
      }
      // User not in DB — fall through to cookie path which can auto-create
    } catch {
      // Fall through to cookie-based Supabase auth.
    }
  }

  // 2) Fallback path: Supabase cookie session.
  //    The Next.js middleware already refreshes tokens and forwards updated
  //    cookies on the request, so we can safely read them here. setAll is a
  //    no-op because we only need to read the (already-refreshed) cookies.
  //    getAuthSessionUser is request-scoped cached so subsequent calls reuse it.
  try {
    const authSessionUser = await getAuthSessionUser(req)
    if (!authSessionUser) return null
    const user = await db.user.findUnique({ where: { id: authSessionUser.id } })
    if (!user || !user.isActive || user.deletedAt) return null
    return user
  } catch {
    return null
  }
}

export function requireAuth(handler: AuthedHandler): Handler {
  return async (req, ctx) => {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    return handler(req, ctx, user)
  }
}

export function requireRole(role: string | string[], handler: AuthedHandler): Handler {
  return requireAuth(async (req, ctx, user) => {
    const roles = Array.isArray(role) ? role : [role]
    if (!roles.includes(user.role)) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    return handler(req, ctx, user)
  })
}

export const requireClient = (handler: AuthedHandler) => requireRole('client', handler)
export const requireCleaner = (handler: AuthedHandler) => requireRole('cleaner', handler)
export const requireAdmin = (handler: AuthedHandler) => requireRole('admin', handler)
export const requireClientOrCleaner = (handler: AuthedHandler) => requireRole(['client', 'cleaner'], handler)
