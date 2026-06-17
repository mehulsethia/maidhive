import { LandingHeader } from '@/components/landing-header'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isSupabaseInvalidRefreshTokenError } from '@/lib/supabase-auth-errors'

const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

function getPostLoginPath(user: { user_metadata?: Record<string, unknown> }) {
  const role = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : 'client'
  if (role === 'cleaner') return '/cleaner/dashboard'
  if (role === 'admin') return '/admin/dashboard'
  return '/client/dashboard'
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // Read-only in layout
        },
      },
    },
  )
  try {
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      redirect(getPostLoginPath(data.user))
    }
  } catch (error) {
    if (!isSupabaseInvalidRefreshTokenError(error)) throw error
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(circle at 14% 0%, rgba(61, 88, 247, 0.1), transparent 32%), radial-gradient(circle at 100% 8%, rgba(14, 165, 233, 0.08), transparent 28%), linear-gradient(180deg, #f4f7ff 0%, #f7f8fc 42%, #f8fafc 100%)',
        }}
      />
      <LandingHeader />
      <div className="relative z-10 flex-1 px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto w-full max-w-6xl space-y-5">
          <section className="relative isolate overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(125deg,#04162f_8%,#0f3b76_58%,#0e5698)]">
            <div
              className="absolute inset-0 opacity-[0.9] mix-blend-screen"
              aria-hidden="true"
              style={{
                backgroundImage:
                  'linear-gradient(105deg, rgba(2, 11, 27, 0.84) 8%, rgba(2, 11, 27, 0.52) 52%, rgba(8, 22, 44, 0.74) 100%), radial-gradient(circle at 82% 18%, rgba(56, 220, 255, 0.24), transparent 34%), repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0 2px, rgba(255, 255, 255, 0) 2px 12px)',
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgba(255,255,255,0.11)_0%,rgba(255,255,255,0)_45%),radial-gradient(circle_at_20%_28%,rgba(56,220,255,0.22),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(244,180,0,0.2),transparent_22%)]"
              aria-hidden="true"
            />
            <div className="relative z-10 px-5 py-3 sm:px-6 sm:py-4">
              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                MaidHive Access
              </p>
              <h1 className={`${displayFont.className} mt-1.5 text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl`}>
                Sign In & Onboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-100/90 sm:text-base">
                Access your account, create a new profile, and complete onboarding with one consistent flow.
              </p>
            </div>
          </section>

          <div className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_18px_45px_rgba(11,33,78,0.08)] backdrop-blur-sm">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
