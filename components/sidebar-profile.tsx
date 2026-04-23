'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronUp, LogOut, Settings, User } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { clearAuthCache } from '@/lib/auth-cache'
import { clearApiCache, clientsApi, cleanersApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/ui/user-avatar'

interface SidebarProfileProps {
  /** e.g. '/cleaner/profile' or '/client/profile' */
  profileHref: string
  /** 'cleaner' | 'client' */
  role: 'cleaner' | 'client'
}

export function SidebarProfile({ profileHref, role }: SidebarProfileProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<{ name: string; email: string; avatarUrl: string | null } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const meta = data.user.user_metadata ?? {}
        setUser({
          name: (meta.name as string) || data.user.email?.split('@')[0] || 'User',
          email: data.user.email || '',
          avatarUrl: null,
        })
      }
    })

    // Fetch avatar from app DB
    ;(role === 'cleaner' ? cleanersApi.me() : clientsApi.me())
      .then((res: any) => {
        const u = role === 'cleaner'
          ? res.data?.cleaner?.user
          : res.data?.user
        const url = u?.avatar_url ?? res.data?.cleaner?.profile_image_url ?? null
        if (url) {
          setUser(prev => prev ? { ...prev, avatarUrl: url } : prev)
        }
      })
      .catch(() => {})
  }, [role])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleLogout() {
    clearAuthCache()
    clearApiCache()
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const roleLabel = role === 'cleaner' ? 'Cleaner' : 'Client'

  return (
    <div ref={ref} className="relative mt-auto border-t border-slate-200 pt-2">
      {/* Popover — rises up above trigger */}
      <div
        className={cn(
          'absolute bottom-full left-0 right-0 mb-2 origin-bottom rounded-xl border border-slate-200 bg-white p-3 shadow-lg transition-all duration-200',
          open
            ? 'pointer-events-auto scale-100 opacity-100 translate-y-0'
            : 'pointer-events-none scale-95 opacity-0 translate-y-2',
        )}
      >
        {/* User info */}
        <div className="mb-3 flex items-center gap-3">
          <UserAvatar
            name={user?.name}
            imageUrl={user?.avatarUrl}
            className="h-10 w-10 shrink-0"
            fallbackClassName="bg-gradient-to-br from-primary to-indigo-600 text-white"
            textClassName="text-sm font-bold"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>

        {/* Role badge */}
        <div className="mb-3 rounded-lg bg-slate-50 px-3 py-1.5">
          <p className="text-xs text-slate-500">
            Role: <span className="font-semibold text-slate-700">{roleLabel}</span>
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-1">
          <Link
            href={profileHref}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <Settings className="h-4 w-4 text-slate-500" />
            Profile Settings
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </div>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 hover:bg-slate-100"
      >
        <UserAvatar
          name={user?.name}
          imageUrl={user?.avatarUrl}
          className="h-8 w-8 shrink-0"
          fallbackClassName="bg-gradient-to-br from-primary to-indigo-600 text-white"
          textClassName="text-xs font-bold"
        />
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-semibold text-slate-900">{user?.name ?? 'Loading...'}</p>
          <p className="text-[11px] text-slate-500">{roleLabel}</p>
        </div>
        <ChevronUp
          className={cn(
            'ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
    </div>
  )
}
