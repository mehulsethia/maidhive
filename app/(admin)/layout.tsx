'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
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

const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

function adminStageCopy(pathname: string) {
  if (pathname.startsWith('/admin/dashboard')) {
    return {
      tag: 'MaidHive Admin Console',
      title: 'Platform Overview',
      desc: 'Monitor platform health, revenue, and operational signals in real time.',
      image: '/images/stage/admin-dashboard.jpg',
    }
  }
  if (pathname.startsWith('/admin/cleaners')) {
    return {
      tag: 'MaidHive Admin Console',
      title: 'Cleaner Operations',
      desc: 'Review onboarding quality, approvals, and cleaner account status.',
      image: '/images/stage/admin-cleaners.jpg',
    }
  }
  if (pathname.startsWith('/admin/bookings')) {
    return {
      tag: 'MaidHive Admin Console',
      title: 'Booking Operations',
      desc: 'Inspect booking flow, statuses, and edge-case interventions.',
      image: '/images/stage/admin-bookings.jpg',
    }
  }
  if (pathname.startsWith('/admin/disputes')) {
    return {
      tag: 'MaidHive Admin Console',
      title: 'Dispute Resolution',
      desc: 'Triages active disputes and apply structured resolution outcomes.',
      image: '/images/stage/admin-disputes.jpg',
    }
  }
  if (pathname.startsWith('/admin/users')) {
    return {
      tag: 'MaidHive Admin Console',
      title: 'User Management',
      desc: 'Audit user accounts, access controls, and account activity.',
      image: '/images/stage/admin-users.jpg',
    }
  }
  return {
    tag: 'MaidHive Admin Console',
    title: 'Administration',
    desc: 'Control and monitor platform operations from one command surface.',
    image: '/images/stage/admin-default.jpg',
  }
}

type AuthState = 'loading' | 'login' | 'authed'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const stage = adminStageCopy(pathname)
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
      <div className="relative min-h-screen px-4 py-8">
        <div className="admin-stage-bg" aria-hidden="true" />
        <div className="relative z-10 mx-auto w-full max-w-sm">
          <section className="admin-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
            <div className="admin-stage__media" aria-hidden="true" />
            <div className="admin-stage__grain" aria-hidden="true" />
            <div className="relative z-10 px-5 py-4 text-white">
              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                MaidHive Admin Console
              </p>
              <h1 className={`${displayFont.className} mt-2 text-3xl font-extrabold tracking-[-0.03em]`}>Restricted Access</h1>
              <p className="mt-2 text-sm text-slate-100/90">Sign in with authorized admin credentials to continue.</p>
            </div>
          </section>

          <form onSubmit={handleLogin} className="mt-5 rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-[0_18px_45px_rgba(11,33,78,0.08)] backdrop-blur-sm">
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

        <style jsx>{`
          .admin-stage-bg {
            position: absolute;
            inset: 0;
            background-image:
              radial-gradient(circle at 14% 0%, rgba(61, 88, 247, 0.1), transparent 32%),
              radial-gradient(circle at 100% 8%, rgba(14, 165, 233, 0.08), transparent 28%),
              linear-gradient(180deg, #f4f7ff 0%, #f7f8fc 42%, #f8fafc 100%);
          }
        `}</style>
      </div>
    )
  }

  // Authenticated admin — full layout
  return (
    <div className="min-h-screen md:pl-60">
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:w-60 md:flex-col md:border-r md:bg-muted/20">
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

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-3 py-3 backdrop-blur md:hidden">
        <div className="mb-2 flex items-center justify-between">
          <Link href="/admin/dashboard" className="text-base font-bold text-primary">
            MaidHive
          </Link>
          <button
            onClick={signOut}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600"
          >
            Sign out
          </button>
        </div>
        <nav className="flex gap-1.5 overflow-x-auto pb-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="px-4 py-4 sm:px-6 md:px-8 md:py-6">
        <div className="space-y-6">
          <section className="admin-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
            <div className="admin-stage__media" aria-hidden="true" />
            <div className="admin-stage__grain" aria-hidden="true" />
            <div className="relative z-10 px-5 py-4 sm:px-6 sm:py-4">
              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                {stage.tag}
              </p>
              <h1 className={`${displayFont.className} mt-2 text-3xl font-extrabold tracking-[-0.03em] text-white sm:text-4xl`}>
                {stage.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-100/90 sm:text-base">{stage.desc}</p>
            </div>
          </section>
          <div>{children}</div>
        </div>
      </main>

      <style jsx>{`
        .admin-stage {
          position: relative;
          isolation: isolate;
          background: linear-gradient(125deg, #04162f 8%, #0f3b76 58%, #0e5698);
        }

        .admin-stage__media {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(105deg, rgba(2, 11, 27, 0.82) 10%, rgba(2, 11, 27, 0.5) 55%, rgba(8, 22, 44, 0.72) 100%),
            radial-gradient(circle at 82% 18%, rgba(56, 220, 255, 0.24), transparent 34%),
            repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0 2px, rgba(255, 255, 255, 0) 2px 12px);
          background-size: cover;
          background-position: center;
          mix-blend-mode: screen;
          opacity: 0.82;
        }

        .admin-stage__grain {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(90deg, rgba(255, 255, 255, 0.11) 0%, rgba(255, 255, 255, 0) 45%),
            radial-gradient(circle at 20% 28%, rgba(56, 220, 255, 0.22), transparent 28%),
            radial-gradient(circle at 82% 12%, rgba(244, 180, 0, 0.2), transparent 22%);
          animation: admin-sweep 11s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes admin-sweep {
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
