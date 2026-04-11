import jwt from 'jsonwebtoken'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { db } from './db'
import type { User } from '@prisma/client'

export type RouteContext = { params: Promise<Record<string, string>> }
type AuthedHandler = (req: NextRequest, ctx: RouteContext, user: User) => Promise<NextResponse>
type Handler = (req: NextRequest, ctx: RouteContext) => Promise<NextResponse>

export async function getAuthUser(req: NextRequest): Promise<User | null> {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '').trim()

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
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: () => {
            /* no-op — middleware handles cookie refresh */
          },
        },
      },
    )

    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return null

    let user = await db.user.findUnique({ where: { id: data.user.id } })

    // Auto-create user row if authenticated in Supabase but missing from DB
    // (handles case where the auth.users trigger didn't fire)
    if (!user) {
      const meta = data.user.user_metadata ?? {}
      try {
        user = await db.user.create({
          data: {
            id: data.user.id,
            email: data.user.email!,
            name: (meta.name as string) || data.user.email!.split('@')[0],
            role: (meta.role as string) || 'client',
            phone: (meta.phone as string) || null,
          },
        })
      } catch {
        // Race condition — another request may have created it
        user = await db.user.findUnique({ where: { id: data.user.id } })
      }
    }

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
