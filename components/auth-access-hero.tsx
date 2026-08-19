'use client'

import { usePathname } from 'next/navigation'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'

const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

export function AuthAccessHero() {
  const pathname = usePathname()
  const isSignup = pathname?.startsWith('/signup')

  return (
    <div className="relative z-10 px-5 py-3 sm:px-6 sm:py-4">
      <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
        MaidHive Access
      </p>
      <h1 className={`${displayFont.className} mt-1.5 text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl`}>
        {isSignup ? 'Join MaidHive' : 'Log in to MaidHive'}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-100/90 sm:text-base">
        {isSignup
          ? 'Create your MaidHive account to get started as a client or cleaner.'
          : 'Access your MaidHive account and manage your bookings, profile and account details.'}
      </p>
    </div>
  )
}
