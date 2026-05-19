'use client'

const loadFailureCounts = new Map<string, number>()

export function resetLoadError(key: string) {
  loadFailureCounts.delete(key)
}

export function reportLoadError(key: string, message: string, toastAfter = Number.POSITIVE_INFINITY) {
  const nextCount = (loadFailureCounts.get(key) ?? 0) + 1
  loadFailureCounts.set(key, nextCount)
  if (nextCount >= toastAfter && Number.isFinite(toastAfter)) {
    // Keep details in console for debugging but avoid noisy UX toasts on passive first-load fetches.
    console.error(message)
  }
}
