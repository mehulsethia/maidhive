'use client'

import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'

function ResetPasswordForm() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { toast.error('Password must be at least 6 characters.'); return }
    if (password !== confirm) { toast.error('Passwords do not match.'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password updated successfully!')
      router.push('/login')
    }
    setLoading(false)
  }

  return (
    <div className="grid md:grid-cols-2 min-h-[620px]">
      {/* Left — Branding panel */}
      <div className="hidden md:flex flex-col bg-slate-50 p-5 lg:p-6">
        <div className="flex flex-1 min-h-[360px] flex-col justify-end rounded-xl border border-slate-200/70 bg-[linear-gradient(130deg,#04162f_5%,#0f3b76_55%,#0e5698_100%)] p-7 shadow-lg">
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/85">MaidHive</p>
          <p className="mt-2 text-xl font-bold text-white">Create a new password and protect your account.</p>
        </div>
      </div>

      {/* Right — Form */}
      <div className="p-8 lg:p-14 flex flex-col justify-center">
        <div className="mx-auto mb-6 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-6 w-6 text-primary" />
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-2 text-center">Create new password</h2>
        <p className="text-sm text-gray-500 mb-8 text-center">
          Your new password must be at least 6 characters long.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              New password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter new password"
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

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Confirm password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all text-sm shadow-sm"
          >
            {loading ? 'Updating...' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
