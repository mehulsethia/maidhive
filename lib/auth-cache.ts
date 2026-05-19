import { createClient } from '@/lib/supabase'

let cachedToken: string | null = null
let cachedExpiry = 0 // unix ms
let inflightTokenPromise: Promise<string | null> | null = null

type AccessTokenOptions = {
  forceRefresh?: boolean
}

/**
 * Returns a valid access token, using cache when possible.
 * Only calls getUser() (network) if token expires within 5 min.
 */
export async function getAccessToken(options: AccessTokenOptions = {}): Promise<string | null> {
  const now = Date.now()
  const REFRESH_BUFFER = 30 * 1000 // only proactively refresh when truly near expiry
  const forceRefresh = Boolean(options.forceRefresh)

  // If cache is fresh, return immediately
  if (!forceRefresh && cachedToken && cachedExpiry - now > REFRESH_BUFFER) {
    return cachedToken
  }

  if (!forceRefresh && inflightTokenPromise) {
    return inflightTokenPromise
  }

  if (forceRefresh) {
    inflightTokenPromise = null
  }

  inflightTokenPromise = (async () => {
    const supabase = createClient()

    // Try getSession first (instant, from localStorage)
    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData.session

    if (session) {
      const expiresAt = (session.expires_at ?? 0) * 1000 // convert to ms
      if (!forceRefresh && expiresAt - now > REFRESH_BUFFER) {
        // Token still valid, cache and return
        cachedToken = session.access_token
        cachedExpiry = expiresAt
        return cachedToken
      }

      // Avoid blocking app navigation on proactive refresh if token is still valid.
      if (!forceRefresh && expiresAt > now) {
        cachedToken = session.access_token
        cachedExpiry = expiresAt
        return cachedToken
      }
    }

    // Token expired or expiring soon — refresh via getUser()
    const { error } = await supabase.auth.getUser()
    if (error) {
      cachedToken = null
      cachedExpiry = 0
      return null
    }

    // After refresh, getSession returns the new token
    const { data: refreshed } = await supabase.auth.getSession()
    if (refreshed.session) {
      cachedToken = refreshed.session.access_token
      cachedExpiry = (refreshed.session.expires_at ?? 0) * 1000
      return cachedToken
    }

    return null
  })()

  try {
    return await inflightTokenPromise
  } finally {
    inflightTokenPromise = null
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  return getAccessToken({ forceRefresh: true })
}

/** Clear cache on logout */
export function clearAuthCache() {
  cachedToken = null
  cachedExpiry = 0
  inflightTokenPromise = null
}
