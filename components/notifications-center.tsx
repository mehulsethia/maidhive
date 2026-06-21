'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, CheckCheck, Inbox, Trash2 } from 'lucide-react'
import { authApi, notificationsApi } from '@/lib/api'
import { getNotificationHref } from '@/lib/notification-links'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { triggerCountsRefresh } from '@/lib/counts-sync'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { normalizeNotificationCopyForRole } from '@/lib/notification-copy'
import type { NotificationRead } from '@/types'
import { toast } from 'sonner'

type NotificationRole = 'client' | 'cleaner' | 'admin'
type NotificationFilter = 'all' | 'unread'

const FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
]

export function NotificationsCenter({ role }: { role: NotificationRole }) {
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const [notifications, setNotifications] = useState<NotificationRead[]>([])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications])

  const visibleNotifications = useMemo(() => {
    if (filter === 'unread') return notifications.filter((n) => !n.is_read)
    return notifications
  }, [filter, notifications])

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true)
    try {
      const res = await notificationsApi.list({ page_size: 250 })
      setNotifications(res.data?.notifications ?? [])
      resetLoadError(`notifications-center-${role}`)
    } catch {
      if (!background) {
        reportLoadError(`notifications-center-${role}`, 'Failed to load notifications.')
      }
    } finally {
      if (!background) setLoading(false)
    }
  }, [role])

  useEffect(() => {
    load(false)
  }, [load])

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let interval: ReturnType<typeof setInterval> | null = null
    let active = true

    ;(async () => {
      const me = await authApi.me().catch(() => null)
      const userId = me?.data?.id
      if (!userId || !active) return

      channel = supabase
        .channel(`notifications:center:${role}:${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          () => {
            load(true)
          },
        )
        .subscribe()

      interval = setInterval(() => load(true), 20000)

    })()

    return () => {
      active = false
      if (interval) clearInterval(interval)
      if (channel) supabase.removeChannel(channel)
    }
  }, [load, role])

  async function markRead(id: string) {
    setWorkingId(id)
    try {
      await notificationsApi.markRead(id)
      setNotifications((prev) => prev.map((notification) => (
        notification.id === id ? { ...notification, is_read: true } : notification
      )))
      triggerCountsRefresh()
    } catch {
      toast.error('Failed to mark notification as read.')
    } finally {
      setWorkingId(null)
    }
  }

  async function markAllRead() {
    setWorkingId('ALL')
    try {
      await notificationsApi.markAllRead()
      setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })))
      triggerCountsRefresh()
    } catch {
      toast.error('Failed to mark all notifications as read.')
    } finally {
      setWorkingId(null)
    }
  }

  async function deleteNotification(id: string) {
    setWorkingId(id)
    try {
      await notificationsApi.delete(id)
      setNotifications((prev) => prev.filter((notification) => notification.id !== id))
      triggerCountsRefresh()
    } catch {
      toast.error('Failed to delete notification.')
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-[0_18px_45px_rgba(11,33,78,0.08)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-[-0.02em] text-slate-900">Notifications</h2>
          <p className="mt-1 text-sm text-slate-500">
            Stay updated with booking, dispute, payment, and account events.
          </p>
        </div>
        <button
          onClick={markAllRead}
          disabled={unreadCount === 0 || workingId === 'ALL'}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Mark all as read
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const count = item.key === 'all' ? notifications.length : unreadCount
          const active = item.key === filter
          return (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                active
                  ? 'bg-primary text-white shadow-[0_8px_16px_rgba(13,75,201,0.32)]'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {item.label}
              <span>{count}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
          ))}
        </div>
      ) : visibleNotifications.length === 0 ? (
        <div className="mt-5 grid min-h-48 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
          <div className="space-y-2">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400">
              <Inbox className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-slate-600">No notifications in this filter.</p>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {visibleNotifications.map((rawNotification) => {
            const notification = normalizeNotificationCopyForRole(role, rawNotification)
            const working = workingId === notification.id
            const href = getNotificationHref(role, notification)
            return (
              <article
                key={notification.id}
                className={cn(
                  'rounded-2xl border px-4 py-3 transition sm:px-5',
                  notification.is_read ? 'border-slate-200 bg-white' : 'border-primary/20 bg-primary/5',
                )}
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0">
                    <p className={cn('text-sm text-slate-900', !notification.is_read && 'font-semibold')}>
                      {notification.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 [overflow-wrap:anywhere]">{notification.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(notification.created_at).toLocaleString('en-IE', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Europe/Nicosia',
                      })}
                    </p>
                    <Link href={href} className="mt-2 inline-flex text-xs font-semibold text-primary hover:underline">
                      Open related item
                    </Link>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:max-w-[15rem]">
                    {!notification.is_read && (
                      <button
                        onClick={() => markRead(notification.id)}
                        disabled={working}
                        className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Mark read
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      disabled={working}
                      className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
