'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { authApi, cleanersApi } from '@/lib/api'
import { PhoneInput } from '@/components/phone-input'
import { toast } from 'sonner'

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const defaultRole = (params.get('role') ?? 'client') as 'client' | 'cleaner'

  const [role, setRole] = useState<'client' | 'cleaner'>(defaultRole)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [experience, setExperience] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin).replace(/\/+$/, '')

    const name = `${firstName} ${lastName}`.trim()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback`,
        data: { name, role, phone, experience: role === 'cleaner' ? experience : undefined },
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    if (data.session) {
      // Session created immediately (email confirmation disabled in Supabase)
      try {
        await authApi.sync({
          name,
          role,
          phone,
          ...(role === 'cleaner' && experience !== '' ? { experience: Number(experience) } : {}),
        })
      } catch {
        // Non-fatal — the DB trigger already created the row
      }

      if (role === 'cleaner') {
        try {
          const cleanerRes = await cleanersApi.me()
          router.push(cleanerRes.data?.onboarding?.completion_pct === 100 ? '/cleaner/dashboard' : '/cleaner/onboarding')
        } catch {
          router.push('/cleaner/onboarding')
        }
      } else {
        router.push('/client/dashboard')
      }
      toast.success('Account created successfully.')
    } else {
      // Email confirmation required — redirect to verification page
      router.push(`/verify-email?email=${encodeURIComponent(email)}`)
      toast.success('Please check your email to verify your account.')
    }

    setLoading(false)
  }

  return (
    <div className="grid lg:grid-cols-2 min-h-[calc(100vh-8rem)]">
      {/* Left — Branding panel */}
      <div className="hidden lg:flex flex-col bg-gray-50 p-8 lg:p-10">
        <div className="relative rounded-xl overflow-hidden shadow-lg flex-1">
          <Image
            src="/images/join-maidhive.avif"
            alt="Professional cleaning team"
            fill
            className="object-cover"
            sizes="400px"
          />
        </div>
      </div>

      {/* Right — Form */}
      <div className="p-6 lg:p-10 flex flex-col justify-center">
        {/* Role toggle */}
        <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1 mb-5">
          {(['client', 'cleaner'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
                role === r
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {r === 'client' ? "I'm a Client" : "I'm a Cleaner"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Enter your first name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Enter your last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <PhoneInput value={phone} onChange={setPhone} />
          </div>

          {/* Role-specific field */}
          {role === 'cleaner' ? (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Years of Experience <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                placeholder="Enter your years of experience"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
              />
            </div>
          ) : null}

          {/* Email */}
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
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
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
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all text-sm shadow-sm"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
