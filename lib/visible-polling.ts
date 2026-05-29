export function setupVisiblePolling(refresh: () => void | Promise<unknown>, intervalMs: number) {
  if (typeof window === 'undefined') return () => {}

  let inFlight = false

  const run = () => {
    if (document.visibilityState !== 'visible') return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    if (inFlight) return
    inFlight = true
    Promise.resolve()
      .then(() => refresh())
      .finally(() => {
        inFlight = false
      })
  }

  const timer = window.setInterval(run, intervalMs)
  const onFocus = () => run()
  const onVisible = () => {
    if (document.visibilityState === 'visible') run()
  }

  window.addEventListener('focus', onFocus)
  window.addEventListener('online', onVisible)
  document.addEventListener('visibilitychange', onVisible)

  return () => {
    window.clearInterval(timer)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('online', onVisible)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
