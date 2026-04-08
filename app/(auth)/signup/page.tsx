'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { authApi } from '@/lib/api'
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
  const [address, setAddress] = useState('')
  const [experience, setExperience] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const name = `${firstName} ${lastName}`.trim()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role, phone, address, experience: role === 'cleaner' ? experience : undefined } },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    try {
      await authApi.sync({ name, role })
    } catch {
      // Non-fatal — the DB trigger already created the row
    }

    toast.success('Account created! Check your email to confirm.')
    router.push(role === 'cleaner' ? '/cleaner/onboarding' : '/client/dashboard')
    setLoading(false)
  }

  return (
    <div className="grid md:grid-cols-2">
      {/* Left — Branding panel */}
      <div className="hidden md:flex flex-col justify-center bg-gray-50 p-10 lg:p-14">
        <h1 className="text-3xl lg:text-4xl font-bold text-primary mb-3 leading-tight">
          Join MaidHive
        </h1>
        <p className="text-gray-500 text-base leading-relaxed mb-8">
          Easily connect with trusted professionals for all
          your home service needs.
        </p>
        <div className="relative rounded-xl overflow-hidden aspect-[4/3] shadow-lg">
          <Image
            src="/images/auth-cleaners.jpg"
            alt="Professional cleaning team"
            fill
            className="object-cover"
            sizes="400px"
          />
        </div>
      </div>

      {/* Right — Form */}
      <div className="p-8 lg:p-14 flex flex-col justify-center">
        {/* Role toggle */}
        <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1 mb-8">
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

        <form onSubmit={handleSubmit} className="space-y-5">
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
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
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
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="Enter your phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
            />
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
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
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
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
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
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-gray-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all text-sm shadow-sm"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-8">
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
