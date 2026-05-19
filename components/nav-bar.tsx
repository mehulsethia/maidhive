'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { authApi } from '@/lib/api'
import { createClient } from '@/lib/supabase'
import { NotificationBell } from '@/components/notification-bell'
import { useRouter } from 'next/navigation'

interface NavLink { href: string; label: string }

interface NavBarProps {
  links: NavLink[]
}

export function NavBar({ links }: NavBarProps) {
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    authApi.me().then((res) => setUserId(res.data?.id ?? null)).catch(() => setUserId(null))
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="border-b px-6 py-3 flex items-center justify-between">
      <Link href="/" className="text-xl font-bold text-primary">MaidHive</Link>

      <nav className="flex items-center gap-6">
        {links.map(l => (
          <Link key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        {userId && <NotificationBell userId={userId} />}
        <button
          onClick={signOut}
          className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
