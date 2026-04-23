'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { LayoutGrid, CalendarDays, MessagesSquare, Bell, User } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clearAuthCache } from '@/lib/auth-cache'
import { clearApiCache, cleanersApi, paymentsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useCounts } from '@/hooks/use-counts'
import { SidebarProfile } from '@/components/sidebar-profile'

const NAV_ITEMS = [
  { href: '/cleaner/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/cleaner/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/cleaner/chats', label: 'Chats', icon: MessagesSquare },
  { href: '/cleaner/notifications', label: 'Notifications', icon: Bell },
  { href: '/cleaner/profile', label: 'Profile', icon: User },
]

const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

function cleanerStageCopy(pathname: string) {
  if (pathname.startsWith('/cleaner/dashboard')) {
    return {
      tag: 'MaidHive Cleaner Hub',
      title: 'Cleaner Dashboard',
      desc: 'Track jobs, manage requests, and run your cleaner business from one focused workspace.',
      image: '/images/stage/cleaner-dashboard.jpg',
    }
  }
  if (pathname.startsWith('/cleaner/bookings')) {
    return {
      tag: 'MaidHive Cleaner Jobs',
      title: 'Cleaner Bookings',
      desc: 'Review every booking, update status, and keep delivery consistent.',
      image: '/images/stage/cleaner-bookings.jpg',
    }
  }
  if (pathname.startsWith('/cleaner/chats')) {
    return {
      tag: 'MaidHive Conversations',
      title: 'Cleaner Chats',
      desc: 'Coordinate directly with clients and keep context tied to each job.',
      image: '/images/stage/cleaner-chats.jpg',
    }
  }
  if (pathname.startsWith('/cleaner/notifications')) {
    return {
      tag: 'MaidHive Updates',
      title: 'Cleaner Notifications',
      desc: 'Track booking actions, payouts, disputes, and account alerts in one timeline.',
      image: '/images/stage/cleaner-default.jpg',
    }
  }
  if (pathname.startsWith('/cleaner/profile')) {
    return {
      tag: 'MaidHive Cleaner Identity',
      title: 'Cleaner Profile',
      desc: 'Present your experience, rates, and availability with a clear professional profile.',
      image: '/images/stage/cleaner-profile.jpg',
    }
  }
  if (pathname.startsWith('/cleaner/availability')) {
    return {
      tag: 'MaidHive Schedule Control',
      title: 'Availability',
      desc: 'Shape your schedule and block times with precision.',
      image: '/images/stage/cleaner-availability.jpg',
    }
  }
  if (pathname.startsWith('/cleaner/earnings')) {
    return {
      tag: 'MaidHive Earnings',
      title: 'Payouts & Earnings',
      desc: 'Monitor completed payouts and performance trends over time.',
      image: '/images/stage/cleaner-earnings.jpg',
    }
  }
  if (pathname.startsWith('/cleaner/onboarding')) {
    return {
      tag: 'MaidHive Onboarding',
      title: 'Cleaner Onboarding',
      desc: 'Complete your setup and move into live booking mode.',
      image: '/images/stage/cleaner-onboarding.jpg',
    }
  }
  return {
    tag: 'MaidHive Cleaner',
    title: 'Cleaner Workspace',
    desc: 'Manage all cleaner operations in one place.',
    image: '/images/stage/cleaner-default.jpg',
  }
}

export function CleanerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isOnboardingRoute = pathname === '/cleaner/onboarding'
  const [gateChecked, setGateChecked] = useState(false)
  const stage = cleanerStageCopy(pathname)

  useEffect(() => {
    let mounted = true

    async function runGate() {
      if (isOnboardingRoute) {
        if (mounted) setGateChecked(true)
        return
      }

      try {
        const [me, stripe] = await Promise.all([
          cleanersApi.me(),
          paymentsApi.getConnectStatus(),
        ])
        const completion = me.data?.onboarding?.completion_pct ?? 0
        if (completion < 100 || !stripe.data?.connected) {
          router.replace('/cleaner/onboarding')
          return
        }
      } catch {
        // If gate check fails, keep current route behavior and let page-level auth handle it.
      } finally {
        if (mounted) setGateChecked(true)
      }
    }

    runGate()
    return () => {
      mounted = false
    }
  }, [isOnboardingRoute, router])

  const { data: counts } = useCounts()

  function getBadge(href: string): number {
    if (!counts) return 0
    if (href === '/cleaner/chats') return counts.unread_chats
    if (href === '/cleaner/bookings') return counts.pending_bookings
    if (href === '/cleaner/notifications') return counts.unread_notifications
    return 0
  }

  async function handleLogout() {
    clearAuthCache()
    clearApiCache()
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (isOnboardingRoute) {
    return (
      <div className="min-h-screen px-3 py-6 sm:px-4 md:px-8 md:py-10">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <section className="cleaner-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
            <div className="cleaner-stage__media" aria-hidden="true" />
            <div className="cleaner-stage__grain" aria-hidden="true" />
            <div className="relative z-10 px-5 py-3 sm:px-6 sm:py-3">
              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                {stage.tag}
              </p>
              <h1 className={`${displayFont.className} mt-1.5 text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl`}>
                {stage.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-100/90 sm:text-base">{stage.desc}</p>
            </div>
          </section>
          <div>{children}</div>
        </div>
        <style jsx>{`
          .cleaner-stage {
            position: relative;
            isolation: isolate;
            background: linear-gradient(125deg, #04162f 8%, #0f3b76 58%, #0e5698);
          }

          .cleaner-stage__media {
            position: absolute;
            inset: 0;
            background-image:
              linear-gradient(105deg, rgba(2, 11, 27, 0.9) 6%, rgba(2, 11, 27, 0.66) 52%, rgba(8, 22, 44, 0.84) 100%),
              radial-gradient(circle at 82% 18%, rgba(56, 220, 255, 0.24), transparent 34%),
              repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0 2px, rgba(255, 255, 255, 0) 2px 12px);
            background-size: cover;
            background-position: center;
            opacity: 0.96;
          }

          .cleaner-stage__grain {
            position: absolute;
            inset: 0;
            background-image:
              linear-gradient(90deg, rgba(255, 255, 255, 0.11) 0%, rgba(255, 255, 255, 0) 45%),
              radial-gradient(circle at 20% 28%, rgba(56, 220, 255, 0.22), transparent 28%),
              radial-gradient(circle at 82% 12%, rgba(244, 180, 0, 0.2), transparent 22%);
            animation: cleaner-sweep 11s ease-in-out infinite;
            pointer-events: none;
          }

          @keyframes cleaner-sweep {
            0%,
            100% {
              transform: translateX(0%);
              opacity: 1;
            }
            50% {
              transform: translateX(1.6%);
              opacity: 0.88;
            }
          }
        `}</style>
      </div>
    )
  }

  if (!gateChecked) {
    return (
      <div className="min-h-screen bg-slate-50" />
    )
  }

  return (
    <div className="min-h-screen text-slate-900 lg:pl-72">
      <div className="mx-auto max-w-[1500px]">
        <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:h-screen lg:w-72 lg:flex-col lg:border-r lg:border-slate-200/80 lg:bg-white/90 lg:px-5 lg:py-6 lg:backdrop-blur-md">
          <Link href="/cleaner/dashboard" className="mb-8 inline-flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-primary to-indigo-700 font-extrabold text-white shadow-[0_10px_24px_rgba(39,70,250,0.35)]">M</span>
            <span className="text-[1.7rem] font-bold tracking-tight text-primary">MaidHive</span>
          </Link>
          <div className="mb-5 border-t border-slate-200/80" />

          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                    active
                      ? 'bg-gradient-to-r from-primary/15 to-indigo-500/10 text-primary shadow-inner'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  <Icon className={cn('h-4 w-4', active && 'scale-105')} />
                  {item.label}
                  {(() => {
                    const badge = getBadge(item.href)
                    return badge > 0 ? (
                      <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    ) : null
                  })()}
                </Link>
              )
            })}
          </nav>

          <SidebarProfile profileHref="/cleaner/profile" role="cleaner" />
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-3 py-3 backdrop-blur lg:hidden">
            <div className="mb-3 flex items-center justify-between">
              <Link href="/cleaner/dashboard" className="inline-flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-primary to-indigo-700 text-sm font-bold text-white">M</span>
                <span className="text-lg font-bold tracking-tight text-primary">MaidHive</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600"
              >
                Log out
              </button>
            </div>
            <nav className="flex gap-1.5 overflow-x-auto pb-0.5">
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative inline-flex min-w-[82px] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold',
                      active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                    {(() => {
                      const badge = getBadge(item.href)
                      return badge > 0 ? (
                        <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                          {badge > 9 ? '9+' : badge}
                        </span>
                      ) : null
                    })()}
                  </Link>
                )
              })}
            </nav>
          </header>

          <main className="app-shell-main mx-auto w-full max-w-[1240px] space-y-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
            <section className="cleaner-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
              <div className="cleaner-stage__media" aria-hidden="true" />
              <div className="cleaner-stage__grain" aria-hidden="true" />
              <div className="relative z-10 px-5 py-3 sm:px-6 sm:py-3">
                <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                  {stage.tag}
                </p>
                <h1 className={`${displayFont.className} mt-1.5 text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl`}>
                  {stage.title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-100/90 sm:text-base">{stage.desc}</p>
              </div>
            </section>
            <div>{children}</div>
          </main>
        </div>
      </div>

      <style jsx>{`
        .cleaner-stage {
          position: relative;
          isolation: isolate;
          background: linear-gradient(125deg, #04162f 8%, #0f3b76 58%, #0e5698);
        }

        .cleaner-stage__media {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(105deg, rgba(2, 11, 27, 0.9) 6%, rgba(2, 11, 27, 0.66) 52%, rgba(8, 22, 44, 0.84) 100%),
            radial-gradient(circle at 82% 18%, rgba(56, 220, 255, 0.24), transparent 34%),
            repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0 2px, rgba(255, 255, 255, 0) 2px 12px);
          background-size: cover;
          background-position: center;
          opacity: 0.96;
        }

        .cleaner-stage__grain {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(90deg, rgba(255, 255, 255, 0.11) 0%, rgba(255, 255, 255, 0) 45%),
            radial-gradient(circle at 20% 28%, rgba(56, 220, 255, 0.22), transparent 28%),
            radial-gradient(circle at 82% 12%, rgba(244, 180, 0, 0.2), transparent 22%);
          animation: cleaner-sweep 11s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes cleaner-sweep {
          0%,
          100% {
            transform: translateX(0%);
            opacity: 1;
          }
          50% {
            transform: translateX(1.6%);
            opacity: 0.88;
          }
        }
      `}</style>
    </div>
  )
}
