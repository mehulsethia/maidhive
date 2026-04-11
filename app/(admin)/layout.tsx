'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  Eye,
  EyeOff,
  LogOut,
  MessageSquareWarning,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const NAV = [
  { href: '/admin/dashboard', label: 'Overview',  icon: BarChart3 },
  { href: '/admin/cleaners',  label: 'Cleaners',  icon: ShieldCheck },
  { href: '/admin/bookings',  label: 'Bookings',  icon: BookOpen },
  { href: '/admin/disputes',  label: 'Disputes',  icon: MessageSquareWarning },
  { href: '/admin/users',     label: 'Users',     icon: Users },
]

type AuthState = 'loading' | 'login' | 'authed'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    checkAdmin()
  }, [])

  async function checkAdmin() {
    setAuthState('loading')
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()

    if (!data.session) {
      setAuthState('login')
      return
    }

    const res = await fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    }).then(r => r.json()).catch(() => null)

    if (res?.data?.role === 'admin') {
      setAuthState('authed')
    } else {
      // Signed in but not admin — sign out of this session and show login
      await supabase.auth.signOut()
      setAuthState('login')
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error('Invalid credentials.')
      setLoginLoading(false)
      return
    }

    // Verify admin role
    const { data } = await supabase.auth.getSession()
    const res = await fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${data.session!.access_token}` },
    }).then(r => r.json()).catch(() => null)

    if (res?.data?.role !== 'admin') {
      toast.error('Access denied. Admin privileges required.')
      await supabase.auth.signOut()
      setLoginLoading(false)
      return
    }

    setAuthState('authed')
    setLoginLoading(false)
    router.push('/admin/dashboard')
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setAuthState('login')
    setEmail('')
    setPassword('')
  }

  // Loading spinner
  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  // Admin login screen
  if (authState === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-indigo-700 text-xl font-extrabold text-white shadow-lg">
              M
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Console</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in with your admin credentials</p>
          </div>

          <form onSubmit={handleLogin} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 pr-11 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50"
              >
                {loginLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            This area is restricted to authorized administrators.
          </p>
        </div>
      </div>
    )
  }

  // Authenticated admin — full layout
  return (
    <div className="min-h-screen flex">
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

      <main className="flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-8 overflow-auto">{children}</main>
    </div>
  )
}
