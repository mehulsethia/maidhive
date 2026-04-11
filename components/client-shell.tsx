'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutGrid,
  Users,
  CalendarDays,
  MessagesSquare,
  User,
  Flag,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { SidebarProfile } from '@/components/sidebar-profile'

const NAV_ITEMS = [
  { href: '/client/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/client/cleaners', label: 'Cleaners', icon: Users },
  { href: '/client/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/client/chats', label: 'Chats', icon: MessagesSquare },
  { href: '/client/profile', label: 'Profile', icon: User },
  { href: '/client/report', label: 'Report', icon: Flag },
]

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto flex max-w-[1500px]">
        <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-72 md:shrink-0 md:flex-col md:border-r md:border-slate-200/80 md:bg-white/90 md:px-5 md:py-6 md:backdrop-blur-md">
          <Link href="/client/dashboard" className="mb-8 inline-flex items-center gap-2.5">
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
                </Link>
              )
            })}
          </nav>

          <SidebarProfile profileHref="/client/profile" role="client" />
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-3 py-3 backdrop-blur md:hidden">
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
            <nav className="grid grid-cols-3 gap-1.5">
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition-colors',
                      active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </header>

          <main className="app-shell-main mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  )
}
