export function getApiBaseUrl(): string {
  const configured = String(process.env.NEXT_PUBLIC_API_URL ?? '').trim()
  if (!configured) return ''

  // In browser, always favor same-origin to avoid CORS/auth breakage across
  // Vercel aliases (e.g. maidhive.vercel.app vs maidhive.app).
  if (typeof window !== 'undefined') {
    try {
      const configuredOrigin = new URL(configured).origin
      if (configuredOrigin !== window.location.origin) {
        return ''
      }
      return configuredOrigin
    } catch {
      return ''
    }
  }

  return configured.replace(/\/+$/, '')
}

export function toApiV1Url(path: string): string {
  return `${getApiBaseUrl()}/api/v1${path}`
}
