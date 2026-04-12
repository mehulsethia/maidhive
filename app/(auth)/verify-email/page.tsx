'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Mail } from 'lucide-react'

function VerifyEmailContent() {
  const params = useSearchParams()
  const email = params.get('email') ?? 'your email'

  return (
    <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center max-w-lg mx-auto">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 mb-6">
        <Mail className="h-8 w-8 text-primary" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
      <p className="text-gray-500 text-sm leading-relaxed mb-6">
        We sent a verification link to <strong className="text-gray-700">{email}</strong>.
        Click the link in the email to verify your account and get started.
      </p>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 mb-6 w-full">
        <p className="font-medium text-slate-700 mb-1">Didn't receive the email?</p>
        <ul className="list-disc list-inside space-y-1 text-xs text-slate-500">
          <li>Check your spam or junk folder</li>
          <li>Make sure you entered the correct email address</li>
          <li>Wait a few minutes and try again</li>
        </ul>
      </div>

      <Link
        href="/login"
        className="text-sm font-medium text-primary hover:underline"
      >
        Back to login
      </Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  )
}
