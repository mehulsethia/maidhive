'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { toast.error('Please enter your email.'); return }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin).replace(/\/+$/, '')

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    })

    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="grid lg:grid-cols-2 min-h-[620px]">
      {/* Left — Branding panel */}
      <div className="hidden lg:flex flex-col bg-gray-50 p-5 lg:p-6">
        <div className="relative overflow-hidden rounded-xl shadow-lg flex-1 min-h-[360px]">
          <Image
            src="/images/join-maidhive.avif"
            alt="Professional cleaning team"
            fill
            className="object-cover"
            sizes="400px"
          />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(2,15,36,0.66),rgba(8,38,85,0.24)_48%,rgba(11,43,87,0.78))]" />
          <div className="absolute inset-x-0 bottom-0 p-7">
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/85">MaidHive</p>
            <p className="mt-2 text-xl font-bold text-white">Securely reset access and get back to your schedule.</p>
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="p-8 lg:p-14 flex flex-col justify-center">
        {sent ? (
          <div className="text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <Mail className="h-6 w-6 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">Check your email</h2>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              We&apos;ve sent a password reset link to <strong>{email}</strong>. Click the link in the email to reset your password.
            </p>
            <p className="text-xs text-gray-400">
              Didn&apos;t receive it? Check your spam folder or{' '}
              <button onClick={() => setSent(false)} className="text-primary hover:underline">try again</button>.
            </p>
            <Link href="/login" className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline mt-4">
              <ArrowLeft className="h-4 w-4" /> Back to login
            </Link>
          </div>
        ) : (
          <>
            <Link href="/login" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
              <ArrowLeft className="h-4 w-4" /> Back to login
            </Link>

            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Forgot password?</h2>
            <p className="text-sm text-gray-500 mb-8">
              Enter the email address associated with your account and we&apos;ll send you a link to reset your password.
            </p>

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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all text-sm shadow-sm"
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
