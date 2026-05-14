import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/client', '/cleaner', '/admin']
const AUTH_ROUTES = ['/login', '/signup', '/verify-email']

type SessionInfo = { userId: string; role: string | null; exp: number } | null

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const padded = part.replace(/-/g, '+').replace(/_/g, '/')
    const json =
      typeof atob === 'function'
        ? atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='))
        : Buffer.from(padded, 'base64').toString('utf8')
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function readSupabaseSession(request: NextRequest): SessionInfo {
  const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .split('.')[0]
  const cookieName = projectRef ? `sb-${projectRef}-auth-token` : null

  // Reassemble chunked cookies (sb-<ref>-auth-token.0, .1, ...) and the single-cookie variant.
  const chunks: string[] = []
  for (const c of request.cookies.getAll()) {
    if (!cookieName) break
    if (c.name === cookieName) chunks.push(c.value)
    else if (c.name.startsWith(`${cookieName}.`)) chunks.push(c.value)
  }
  if (chunks.length === 0) return null

  let raw = chunks.join('')
  if (raw.startsWith('base64-')) {
    const b64 = raw.slice(7)
    try {
      raw =
        typeof atob === 'function'
          ? atob(b64)
          : Buffer.from(b64, 'base64').toString('utf8')
    } catch {
      return null
    }
  }

  let token: string | null = null
  let userMeta: Record<string, unknown> | null = null
  try {
    const parsed = JSON.parse(raw) as
      | { access_token?: string; user?: { user_metadata?: Record<string, unknown> } }
      | [string, ...unknown[]]
    if (Array.isArray(parsed)) {
      token = typeof parsed[0] === 'string' ? parsed[0] : null
    } else {
      token = parsed.access_token ?? null
      userMeta = parsed.user?.user_metadata ?? null
    }
  } catch {
    return null
  }
  if (!token) return null

  const payload = decodeJwtPayload(token)
  if (!payload) return null

  const exp = typeof payload.exp === 'number' ? payload.exp * 1000 : 0
  if (exp && exp < Date.now()) return null

  const userId = typeof payload.sub === 'string' ? payload.sub : ''
  const meta = (userMeta ?? (payload.user_metadata as Record<string, unknown> | undefined)) ?? null
  const role = meta && typeof meta.role === 'string' ? (meta.role as string) : null

  return { userId, role, exp }
}

function postLoginPath(role: string | null) {
  if (role === 'cleaner') return '/cleaner/dashboard'
  if (role === 'admin') return '/admin/dashboard'
  return '/client/dashboard'
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p))
  const isApiRoute = pathname.startsWith('/api')
  const isLanding = pathname === '/'

  // Fast path: routes that never need session inspection.
  if (!isProtected && !isAuthRoute && !isLanding) {
    return NextResponse.next()
  }

  const session = readSupabaseSession(request)

  if (isProtected && !session) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  if (isProtected && session) {
    const isClientRoute = pathname.startsWith('/client')
    const isCleanerRoute = pathname.startsWith('/cleaner')
    const isAdminRoute = pathname.startsWith('/admin')
    const role = session.role
    if (
      (isClientRoute && role === 'cleaner') ||
      (isCleanerRoute && role === 'client') ||
      (isAdminRoute && role !== 'admin')
    ) {
      const url = request.nextUrl.clone()
      url.pathname = postLoginPath(role)
      return NextResponse.redirect(url)
    }
  }

  if (isAuthRoute && session) {
    const url = request.nextUrl.clone()
    const next = request.nextUrl.searchParams.get('next')
    url.pathname = next && next.startsWith('/') ? next : postLoginPath(session.role)
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (isLanding && session && !isApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = postLoginPath(session.role)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/signup',
    '/verify-email',
    '/client/:path*',
    '/cleaner/:path*',
    '/admin/:path*',
  ],
}
