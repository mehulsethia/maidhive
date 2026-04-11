'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { authApi, cleanersApi } from '@/lib/api'
import { toast } from 'sonner'

const COUNTRY_CODES = [
  { label: 'US/CA (+1)', value: '+1' },
  { label: 'IN (+91)', value: '+91' },
  { label: 'GB (+44)', value: '+44' },
  { label: 'AU (+61)', value: '+61' },
  { label: 'DE (+49)', value: '+49' },
  { label: 'FR (+33)', value: '+33' },
  { label: 'NL (+31)', value: '+31' },
  { label: 'SG (+65)', value: '+65' },
  { label: 'AE (+971)', value: '+971' },
]

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const defaultRole = (params.get('role') ?? 'client') as 'client' | 'cleaner'

  const [role, setRole] = useState<'client' | 'cleaner'>(defaultRole)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [countryCode, setCountryCode] = useState('+1')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [experience, setExperience] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const name = `${firstName} ${lastName}`.trim()
    const phoneDigits = phone.replace(/\D/g, '')
    const fullPhone = `${countryCode}${phoneDigits}`

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/${role === 'cleaner' ? 'cleaner/onboarding' : 'client/dashboard'}`,
        data: { name, role, phone: fullPhone, address, experience: role === 'cleaner' ? experience : undefined },
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    // If Supabase didn't auto-create a session (e.g. email confirmation enabled),
    // sign in immediately — we skip email verification for now.
    if (!data.session) {
      const signInRes = await supabase.auth.signInWithPassword({ email, password })
      if (signInRes.error) {
        // Email confirmation may be enforced at the Supabase level.
        // Still try to proceed — worst case the sync call will fail gracefully.
        console.warn('Auto sign-in after signup failed:', signInRes.error.message)
      }
    }

    try {
      await authApi.sync({ name, role, phone: fullPhone })
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
    setLoading(false)
  }

  return (
    <div className="grid md:grid-cols-2 min-h-[calc(100vh-8rem)]">
      {/* Left — Branding panel */}
      <div className="hidden md:flex flex-col bg-gray-50 p-8 lg:p-10">
        <div className="mb-5">
          <h1 className="text-2xl lg:text-3xl font-bold text-primary mb-2 leading-tight">
            Join MaidHive
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Easily connect with trusted professionals for all
            your home service needs.
          </p>
        </div>
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
            <div className="grid grid-cols-[9.5rem_1fr] gap-3">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              >
                {COUNTRY_CODES.map((code) => (
                  <option key={code.value} value={code.value}>
                    {code.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                required
                placeholder="Enter your phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
              />
            </div>
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
          ) : (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Enter your address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
              />
            </div>
          )}

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
