'use client'

import { createContext, useContext, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { InitialSession, SessionCounts } from '@/server/session-bootstrap'

const SessionContext = createContext<InitialSession | null>(null)

export function SessionProvider({
  initialSession,
  children,
}: {
  initialSession: InitialSession
  children: React.ReactNode
}) {
  const queryClient = useQueryClient()

  // Seed the sidebar-counts cache so useCounts() returns instantly on mount
  // and only background-refetches afterwards.
  useEffect(() => {
    queryClient.setQueryData<SessionCounts>(['sidebar-counts'], initialSession.counts)
  }, [queryClient, initialSession.counts])

  return <SessionContext.Provider value={initialSession}>{children}</SessionContext.Provider>
}

export function useSession(): InitialSession {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return ctx
}

export function useOptionalSession(): InitialSession | null {
  return useContext(SessionContext)
}
