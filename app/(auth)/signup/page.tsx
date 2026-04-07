'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { authApi } from '@/lib/api'
import { toast } from 'sonner'

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const defaultRole = (params.get('role') ?? 'client') as 'client' | 'cleaner'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'client' | 'cleaner'>(defaultRole)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role } },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    // Sync profile to backend (the DB trigger creates a minimal row;
    // this call fills in name + role)
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
    <>
      <h1 className="text-2xl font-semibold mb-6">Create your account</h1>

      {/* Role selector */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        {(['client', 'cleaner'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`py-2 rounded-md border text-sm font-medium capitalize transition-colors ${
              role === r
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-muted'
            }`}
          >
            {r === 'client' ? 'I need cleaning' : 'I am a cleaner'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1">Full name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-primary-foreground py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
