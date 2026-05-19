'use client'

import { toast } from 'sonner'

const loadFailureCounts = new Map<string, number>()

export function resetLoadError(key: string) {
  loadFailureCounts.delete(key)
}

export function reportLoadError(key: string, message: string, toastAfter = 2) {
  const nextCount = (loadFailureCounts.get(key) ?? 0) + 1
  loadFailureCounts.set(key, nextCount)
  if (nextCount >= toastAfter) {
    toast.error(message)
  }
}
