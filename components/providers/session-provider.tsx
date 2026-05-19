'use client'

import { createContext, useContext, useRef } from 'react'
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
  const seededRef = useRef(false)

  // Seed the sidebar-counts cache synchronously during render, BEFORE child
  // useCounts() effects fire. Using a ref guard prevents repeated overwrites
  // on re-renders so background refetches aren't clobbered.
  if (!seededRef.current) {
    queryClient.setQueryData<SessionCounts>(['sidebar-counts'], initialSession.counts)
    seededRef.current = true
  }

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
