'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

/**
 * Returns the current Supabase JWT access token.
 * Refreshes automatically when the session changes.
 * Use this anywhere you need to make authenticated fetch() calls.
 */
export function useSupabaseToken(): string | null {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Get initial token
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null)
    })

    // Keep in sync with auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return token
}
