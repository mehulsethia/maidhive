'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  LogOut,
  MessageSquareWarning,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin/dashboard', label: 'Overview',  icon: BarChart3 },
  { href: '/admin/cleaners',  label: 'Cleaners',  icon: ShieldCheck },
  { href: '/admin/bookings',  label: 'Bookings',  icon: BookOpen },
  { href: '/admin/disputes',  label: 'Disputes',  icon: MessageSquareWarning },
  { href: '/admin/users',     label: 'Users',     icon: Users },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  // Guard: only admins may enter
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace('/login')
        return
      }
      // Fetch role from our backend
      const res = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      }).then(r => r.json()).catch(() => null)

      if (res?.data?.role !== 'admin') {
        router.replace('/')
        return
      }
      setChecking(false)
    })
  }, [router])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 border-r min-h-screen flex flex-col bg-muted/20">
        <div className="px-6 py-5 border-b">
          <Link href="/admin/dashboard" className="text-base font-bold text-primary">
            MaidHive
          </Link>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-widest">
            Admin console
          </p>
        </div>

        <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-8 overflow-auto">{children}</main>
    </div>
  )
}
