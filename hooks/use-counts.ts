'use client'

import { useQuery } from '@tanstack/react-query'

async function fetchCounts(): Promise<{ unread_chats: number; pending_bookings: number; unread_notifications: number }> {
  const { getAccessToken } = await import('@/lib/auth-cache')
  const token = await getAccessToken()
  if (!token) return { unread_chats: 0, pending_bookings: 0, unread_notifications: 0 }

  const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''
  const res = await fetch(`${BASE}/api/v1/counts`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  })

  if (!res.ok) return { unread_chats: 0, pending_bookings: 0, unread_notifications: 0 }
  const json = await res.json()
  return json.data ?? { unread_chats: 0, pending_bookings: 0, unread_notifications: 0 }
}

export function useCounts() {
  return useQuery({
    queryKey: ['sidebar-counts'],
    queryFn: fetchCounts,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  })
}
