export function isSupabaseInvalidRefreshTokenError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const candidate = error as {
    code?: unknown
    status?: unknown
    message?: unknown
    name?: unknown
    __isAuthError?: unknown
  }
  const message = String(candidate.message ?? '').toLowerCase()

  return (
    candidate.__isAuthError === true &&
    candidate.status === 400 &&
    (candidate.code === 'refresh_token_not_found' ||
      (message.includes('invalid refresh token') && message.includes('refresh token not found')))
  )
}
