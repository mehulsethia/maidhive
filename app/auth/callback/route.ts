import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/server/db'

/**
 * Handles Supabase email confirmation redirects.
 * Supabase sends the user here with a `code` query param after they click
 * the verification link in their email. We exchange the code for a session
 * and redirect to the appropriate dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as any),
            )
          },
        },
      },
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      const role = user?.user_metadata?.role as string | undefined
      const phone = user?.user_metadata?.phone as string | undefined

      // Ensure role-specific profile exists (same as authApi.sync)
      if (user) {
        try {
          const dbUser = await db.user.findUnique({ where: { id: user.id } })
          if (dbUser) {
            // Update phone if provided in metadata
            if (phone && !dbUser.phone) {
              await db.user.update({ where: { id: user.id }, data: { phone } })
            }

            if (dbUser.role === 'client') {
              const existing = await db.client.findFirst({ where: { userId: user.id } })
              if (!existing) await db.client.create({ data: { userId: user.id } })
            } else if (dbUser.role === 'cleaner') {
              const existing = await db.cleaner.findFirst({ where: { userId: user.id } })
              if (!existing) await db.cleaner.create({ data: { userId: user.id, hourlyRate: 15 } })
            }
          }
        } catch {
          // Non-fatal — app will retry via authApi.sync on page load
        }
      }

      let redirectTo = next
      if (redirectTo === '/') {
        if (role === 'cleaner') {
          redirectTo = '/cleaner/onboarding'
        } else {
          redirectTo = '/client/dashboard'
        }
      }

      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=verification_failed`)
}
