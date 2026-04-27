import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/server/db'
import { loopsEmailService } from '@/server/services/loops-email.service'
import { pushInAppNotification } from '@/server/services/in-app-notification.service'

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
      const rawExperience = user?.user_metadata?.experience
      const experience =
        typeof rawExperience === 'number'
          ? Math.max(0, Math.trunc(rawExperience))
          : typeof rawExperience === 'string' && rawExperience.trim() !== ''
            ? Math.max(0, Math.trunc(Number(rawExperience)))
            : null

      // Ensure role-specific profile exists (same as authApi.sync)
      if (user) {
        try {
          const dbUser = await db.user.findUnique({ where: { id: user.id } })
          if (dbUser) {
            // Keep profile fields synced from signup metadata.
            if ((phone && phone !== dbUser.phone) || ((user.user_metadata?.name as string | undefined) && (user.user_metadata?.name as string) !== dbUser.name)) {
              await db.user.update({
                where: { id: user.id },
                data: {
                  ...(phone ? { phone } : {}),
                  ...(typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()
                    ? { name: user.user_metadata.name.trim() }
                    : {}),
                },
              })
            }

            if (dbUser.role === 'client') {
              const existing = await db.client.findFirst({ where: { userId: user.id } })
              if (!existing) {
                await db.client.create({ data: { userId: user.id } })
                await pushInAppNotification({
                  userId: user.id,
                  type: 'account_created',
                  title: 'Welcome to MaidHive',
                  body: 'Your client profile is ready. Start by browsing available cleaners.',
                })
                try {
                  await loopsEmailService.sendClientAccountCreated({
                    email: dbUser.email,
                    fullName: dbUser.name ?? 'Client',
                  })
                } catch (emailError) {
                  console.error('Failed to send client account created email via Loops:', emailError)
                }
              }
            } else if (dbUser.role === 'cleaner') {
              let existing = await db.cleaner.findFirst({ where: { userId: user.id } })
              if (!existing) {
                existing = await db.cleaner.create({ data: { userId: user.id, hourlyRate: 15 } })
                await pushInAppNotification({
                  userId: user.id,
                  type: 'account_created',
                  title: 'Welcome to MaidHive',
                  body: 'Your cleaner profile is created. Complete onboarding to start receiving jobs.',
                })
                try {
                  await loopsEmailService.sendCleanerSignup({
                    email: dbUser.email,
                    fullName: dbUser.name ?? 'Cleaner',
                  })
                } catch (emailError) {
                  console.error('Failed to send cleaner signup email via Loops:', emailError)
                }
              }
              if (existing && experience !== null && Number.isFinite(experience)) {
                await db.cleaner.update({
                  where: { id: existing.id },
                  data: { yearsExperience: experience },
                })
              }
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
