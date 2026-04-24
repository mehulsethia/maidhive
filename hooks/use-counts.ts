'use client'

import { useQuery } from '@tanstack/react-query'
import { toApiV1Url } from '@/lib/api-base'

async function fetchCounts(): Promise<{ unread_chats: number; pending_bookings: number; unread_notifications: number }> {
  const { getAccessToken } = await import('@/lib/auth-cache')
  const token = await getAccessToken()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const [countsRes, notificationsRes] = await Promise.all([
    fetch(toApiV1Url('/counts'), {
      headers,
      credentials: 'include',
      cache: 'no-store',
    }),
    // Use notifications endpoint for unread count so badge remains reliable
    // even if aggregate count query logic changes.
    fetch(toApiV1Url('/notifications?unread_only=true&include_archived=true&page=1&page_size=1'), {
      headers,
      credentials: 'include',
      cache: 'no-store',
    }),
  ])

  if (!countsRes.ok) return { unread_chats: 0, pending_bookings: 0, unread_notifications: 0 }
  const countsJson = await countsRes.json().catch(() => ({}))
  const countsData = countsJson?.data ?? { unread_chats: 0, pending_bookings: 0, unread_notifications: 0 }

  if (!notificationsRes.ok) {
    return countsData
  }

  const notificationsJson = await notificationsRes.json().catch(() => ({}))
  const unreadFromNotifications = Number(notificationsJson?.data?.total ?? 0)

  return {
    unread_chats: Number(countsData.unread_chats ?? 0),
    pending_bookings: Number(countsData.pending_bookings ?? 0),
    unread_notifications: Number.isFinite(unreadFromNotifications)
      ? unreadFromNotifications
      : Number(countsData.unread_notifications ?? 0),
  }
}

export function useCounts() {
  return useQuery({
    queryKey: ['sidebar-counts'],
    queryFn: fetchCounts,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
    refetchOnWindowFocus: true,
  })
}
