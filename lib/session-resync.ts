'use client'

import { createClient } from '@/lib/supabase'

let inFlightResync: Promise<boolean> | null = null

export async function forceSessionResync() {
  if (inFlightResync) return inFlightResync

  inFlightResync = (async () => {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.refreshSession()
      if (!error) return true
      // Fallback probe to let Supabase refresh user/session from cookies where possible.
      const probe = await supabase.auth.getUser()
      return !probe.error
    } catch {
      return false
    } finally {
      inFlightResync = null
    }
  })()

  return inFlightResync
}
