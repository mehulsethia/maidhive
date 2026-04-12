'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutGrid, CalendarDays, MessagesSquare, User } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clearAuthCache } from '@/lib/auth-cache'
import { cleanersApi, paymentsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useCounts } from '@/hooks/use-counts'
import { SidebarProfile } from '@/components/sidebar-profile'

const NAV_ITEMS = [
  { href: '/cleaner/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/cleaner/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/cleaner/chats', label: 'Chats', icon: MessagesSquare },
  { href: '/cleaner/profile', label: 'Profile', icon: User },
]

export function CleanerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isOnboardingRoute = pathname === '/cleaner/onboarding'
  const [gateChecked, setGateChecked] = useState(false)

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
    return 0
  }

  async function handleLogout() {
    clearAuthCache()
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (isOnboardingRoute) {
    return (
      <div className="min-h-screen bg-slate-50 px-3 py-6 sm:px-4 md:px-8 md:py-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </div>
    )
  }

  if (!gateChecked) {
    return (
      <div className="min-h-screen bg-slate-50" />
    )
  }

  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto flex max-w-[1500px]">
        <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-72 md:shrink-0 md:flex-col md:border-r md:border-slate-200/80 md:bg-white/90 md:px-5 md:py-6 md:backdrop-blur-md">
          <Link href="/cleaner/dashboard" className="mb-8 inline-flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-primary to-indigo-700 font-extrabold text-white shadow-[0_10px_24px_rgba(39,70,250,0.35)]">M</span>
            <span className="text-[1.7rem] font-bold tracking-tight text-primary">MaidHive</span>
          </Link>

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

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-3 py-3 backdrop-blur md:hidden">
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
            <nav className="grid grid-cols-4 gap-1.5">
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold',
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

          <main className="app-shell-main mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 md:px-8 md:pt-16 md:pb-12">{children}</main>
        </div>
      </div>
    </div>
  )
}
