'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutGrid,
  Users,
  CalendarDays,
  MessagesSquare,
  Bell,
  User,
  Flag,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clearAuthCache } from '@/lib/auth-cache'
import { clearApiCache } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useCounts } from '@/hooks/use-counts'
import { SidebarProfile } from '@/components/sidebar-profile'
import { useSession } from '@/components/providers/session-provider'

const NAV_ITEMS = [
  { href: '/client/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/client/cleaners', label: 'Cleaners', icon: Users },
  { href: '/client/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/client/chats', label: 'Messages', icon: MessagesSquare },
  { href: '/client/notifications', label: 'Notifications', icon: Bell },
  { href: '/client/report', label: 'Report', icon: Flag },
  { href: '/client/profile', label: 'Profile', icon: User },
]

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  // useSession is required to be mounted under SessionProvider (set up in (client)/layout.tsx).
  // It's not used directly here but ensures the provider exists in the tree for child components.
  useSession()

  const { data: counts } = useCounts()

  function getBadge(href: string): number {
    if (!counts) return 0
    if (href === '/client/chats') return counts.unread_chats
    if (href === '/client/bookings') return counts.pending_bookings
    if (href === '/client/notifications') return counts.unread_notifications
    return 0
  }

  async function handleLogout() {
    clearAuthCache()
    clearApiCache()
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen overflow-x-hidden text-slate-900 lg:pl-72">
      <div className="mx-auto max-w-[1500px]">
        <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:h-screen lg:w-72 lg:flex-col lg:border-r lg:border-slate-200/80 lg:bg-white/90 lg:px-5 lg:py-6 lg:backdrop-blur-md">
          <Link href="/client/dashboard" className="mb-8 inline-flex items-center gap-2.5">
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

          <SidebarProfile profileHref="/client/profile" role="client" />
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-3 py-3 backdrop-blur lg:hidden">
            <div className="mb-3 flex items-center justify-between">
              <Link href="/client/dashboard" className="inline-flex items-center gap-2">
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
            <nav className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative inline-flex min-w-[86px] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition-colors',
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

          <main className="app-shell-main mx-auto w-full max-w-[1240px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
