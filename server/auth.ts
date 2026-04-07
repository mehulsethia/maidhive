import jwt from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'
import { db } from './db'
import type { User } from '@prisma/client'

export type RouteContext = { params: Promise<Record<string, string>> }
type AuthedHandler = (req: NextRequest, ctx: RouteContext, user: User) => Promise<NextResponse>
type Handler = (req: NextRequest, ctx: RouteContext) => Promise<NextResponse>

export async function getAuthUser(req: NextRequest): Promise<User | null> {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '').trim()
  if (!token) return null

  try {
    const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!, {
      audience: 'authenticated',
    }) as { sub: string }

    const user = await db.user.findUnique({ where: { id: payload.sub } })
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
