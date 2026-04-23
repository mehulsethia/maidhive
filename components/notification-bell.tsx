'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Bell, Check, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { notificationsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { NotificationRead } from '@/types'

// Notification type → route to navigate on click
const NOTIFICATION_LINKS: Record<string, (data?: Record<string, any>) => string> = {
  booking_confirmed:          (d) => d?.booking_id ? `/client/bookings/${d.booking_id}` : '/client/dashboard',
  payment_captured:           (d) => d?.booking_id ? `/client/bookings/${d.booking_id}` : '/client/dashboard',
  stripe_onboarding_complete: () => '/cleaner/dashboard',
  booking_accepted:           (d) => d?.booking_id ? `/cleaner/bookings/${d.booking_id}` : '/cleaner/dashboard',
  new_booking_request:        (d) => d?.booking_id ? `/cleaner/bookings/${d.booking_id}` : '/cleaner/dashboard',
}

function getLink(n: NotificationRead): string {
  const fn = NOTIFICATION_LINKS[n.type]
  return fn ? fn(n.data) : '#'
}

interface NotificationBellProps {
  userId: string
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<NotificationRead[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.is_read).length

  const load = useCallback(async () => {
    try {
      const res = await notificationsApi.list()
      setNotifications(res.data?.notifications ?? [])
    } catch {}
  }, [])

  // Initial load
  useEffect(() => { load() }, [load])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Supabase Realtime — listen for new notifications for this user
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as NotificationRead
          setNotifications(prev => [n, ...prev])

          // Browser notification (if permission granted)
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(n.title, { body: n.body, icon: '/favicon.ico' })
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  async function markAllRead() {
    if (unreadCount === 0) return
    await notificationsApi.markAllRead().catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  async function markRead(id: string) {
    await notificationsApi.markRead(id).catch(() => {})
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative h-9 w-9 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(20rem,calc(100vw-1rem))] overflow-hidden rounded-xl border bg-background shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-96">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    'flex gap-3 px-4 py-3 border-b last:border-0 transition-colors hover:bg-muted/40 cursor-pointer',
                    !n.is_read && 'bg-primary/5',
                  )}
                  onClick={() => { markRead(n.id); setOpen(false) }}
                >
                  {/* Unread dot */}
                  <div className="pt-1 shrink-0">
                    <div className={cn(
                      'h-2 w-2 rounded-full mt-0.5',
                      n.is_read ? 'bg-transparent' : 'bg-primary',
                    )} />
                  </div>

                  <Link href={getLink(n)} className="flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                    <p className={cn('text-sm leading-snug', !n.is_read && 'font-medium')}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleString('en-IE', {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                        timeZone: 'Europe/Nicosia',
                      })}
                    </p>
                  </Link>

                  {!n.is_read && (
                    <button
                      onClick={e => { e.stopPropagation(); markRead(n.id) }}
                      className="shrink-0 self-start mt-0.5 text-muted-foreground hover:text-foreground"
                      aria-label="Mark as read"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
