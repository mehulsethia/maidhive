'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { cleanersApi } from '@/lib/api'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
    } else {
      const nextParam = params.get('next')
      const safeNext = nextParam && nextParam.startsWith('/') ? nextParam : null
      const role = (data.user?.user_metadata?.role as string | undefined) ?? 'client'

      let next = safeNext
      if (!next) {
        if (role === 'cleaner') {
          try {
            const cleanerRes = await cleanersApi.me()
            next = cleanerRes.data?.onboarding?.completion_pct === 100 ? '/cleaner/dashboard' : '/cleaner/onboarding'
          } catch {
            next = '/cleaner/onboarding'
          }
        } else if (role === 'admin') {
          next = '/admin/dashboard'
        } else {
          next = '/client/dashboard'
        }
      }

      router.replace(next)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="grid md:grid-cols-2 min-h-[620px]">
      {/* Left — Branding panel */}
      <div className="hidden md:flex flex-col bg-slate-50 p-5 lg:p-6">
        <div className="flex flex-1 min-h-[360px] flex-col justify-end rounded-xl border border-slate-200/70 bg-[linear-gradient(130deg,#04162f_5%,#0f3b76_55%,#0e5698_100%)] p-7 shadow-lg">
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/85">MaidHive</p>
          <p className="mt-2 text-xl font-bold text-white">Keep every booking and payout in one place.</p>
        </div>
      </div>

      {/* Right — Form */}
      <div className="p-8 lg:p-14 flex flex-col justify-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-8">
          Log in to your account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
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

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/20"
              />
              <span className="text-sm text-gray-600">Remember me</span>
            </label>
            <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all text-sm shadow-sm"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-8">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
