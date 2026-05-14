import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/client', '/cleaner', '/admin']
const AUTH_ROUTES = ['/login', '/signup', '/verify-email']

function getPostLoginPath(role: string | null) {
  if (role === 'cleaner') return '/cleaner/dashboard'
  if (role === 'admin') return '/admin/dashboard'
  return '/client/dashboard'
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p))
  const isLanding = pathname === '/'

  // Fast path: routes that never need session inspection.
  if (!isProtected && !isAuthRoute && !isLanding) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getSession reads from cookies only (no network). Acceptable for routing —
  // backend re-validates JWT on every authenticated request.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const role =
    user && typeof user.user_metadata?.role === 'string'
      ? (user.user_metadata.role as string)
      : null

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  if (isProtected && user) {
    const isClientRoute = pathname.startsWith('/client')
    const isCleanerRoute = pathname.startsWith('/cleaner')
    const isAdminRoute = pathname.startsWith('/admin')
    if (
      (isClientRoute && role === 'cleaner') ||
      (isCleanerRoute && role === 'client') ||
      (isAdminRoute && role !== 'admin')
    ) {
      const url = request.nextUrl.clone()
      url.pathname = getPostLoginPath(role)
      return NextResponse.redirect(url)
    }
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    const next = request.nextUrl.searchParams.get('next')
    url.pathname = next && next.startsWith('/') ? next : getPostLoginPath(role)
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (isLanding && user) {
    const url = request.nextUrl.clone()
    url.pathname = getPostLoginPath(role)
    return NextResponse.redirect(url)
  }

  return response
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
