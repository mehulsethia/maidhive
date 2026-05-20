/**
 * Typed API client for the MaidHive API routes.
 * Every request attaches the Supabase JWT from the current session.
 */
import { getAccessToken, refreshAccessToken } from '@/lib/auth-cache'
import { getApiBaseUrl } from '@/lib/api-base'
import type {
  AdminCleaner,
  AdminDispute,
  AdminOpsQueues,
  AdminStats,
  AdminUser,
  APIResponse,
  BookingCreate,
  BookingFlowDraftRead,
  BookingRead,
  CleanerRead,
  CleanerOnboardingProgress,
  CleanerSummary,
  FavoriteCleaner,
  ClientAddressCreate,
  ClientAddressUpdate,
  ClientAddressRead,
  ClientProfileRead,
  ClientDispute,
  MessageRead,
  NotificationRead,
  PaginatedResponse,
  PaymentIntentResponse,
  PriceBreakdown,
  ReviewCreate,
  ReviewRead,
  UserRead,
  UserUpdate,
} from '@/types'
import type { DisputeIssueType } from '@/lib/dispute-issues'

const BASE = getApiBaseUrl()
const GET_CACHE_TTL_MS = Number(process.env.NEXT_PUBLIC_API_CLIENT_CACHE_TTL_MS ?? 30000)
const REQUEST_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_REQUEST_TIMEOUT_MS ?? 25000)
const GET_REQUEST_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_GET_REQUEST_TIMEOUT_MS ?? 30000)
const RETRY_REQUEST_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_RETRY_TIMEOUT_MS ?? 60000)
const GET_RETRY_BACKOFF_MS = Number(process.env.NEXT_PUBLIC_API_GET_RETRY_BACKOFF_MS ?? 400)

type AnyObj = Record<string, any>
type CachedResponse = { expiresAt: number; data: unknown }

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const getResponseCache = new Map<string, CachedResponse>()
const inFlightGetRequests = new Map<string, Promise<unknown>>()

function toUserFriendlyErrorMessage(message: string, fallbackStatus: number): string {
  const text = String(message || '').trim()
  const lower = text.toLowerCase()

  if (!text) return `Something went wrong. Please try again. (${fallbackStatus})`
  if (lower === 'unknown error') return 'Something went wrong. Please try again.'
  if (lower.includes('invalid datetime')) return 'Please select a valid date and time.'
  if (lower.includes('booking draft status is not enabled') || lower.includes('status migration')) {
    return 'Booking is temporarily unavailable. Please try again in a few minutes.'
  }
  if (lower.includes('request failed:')) return `Request failed (${fallbackStatus}). Please try again.`
  if (lower.includes('zoderror') || lower.includes('validation')) return 'Some details are invalid. Please check and try again.'

  return text
}

function normalizePaginated<T>(payload: AnyObj, key: string): PaginatedResponse<T> {
  const items = (payload?.items ?? payload?.[key] ?? []) as T[]
  const total = Number(payload?.total ?? items.length ?? 0)
  const page = Number(payload?.page ?? 1)
  const pageSize = Number(payload?.page_size ?? payload?.pageSize ?? 20)
  return {
    items,
    total,
    page,
    page_size: pageSize,
    has_next: page * pageSize < total,
  }
}

async function getAuthHeaders(forceRefresh = false): Promise<HeadersInit> {
  const token = forceRefresh ? await refreshAccessToken() : await getAccessToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export function clearApiCache() {
  getResponseCache.clear()
  inFlightGetRequests.clear()
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

// Statuses we retry once. 401 stays in here because it triggers the
// "force-refresh token + retry" flow that recovers from a stale JWT.
// 403 is NOT here — Forbidden is a real permission failure, not transient.
function isTransientStatus(status: number) {
  return status === 401 || status === 408 || status === 429 || status >= 500
}

// Retry only on genuine network/fetch failures and aborts. Anything else surfaces.
function isTransientFetchError(error: unknown) {
  if (!(error instanceof Error)) return false
  if (error.name === 'AbortError') return true
  if (error.name === 'TypeError') return true // browser fetch network error
  return false
}

async function executeRequest<T>(path: string, options: RequestInit, method: string): Promise<T> {
  const runRequest = async (forceRefresh = false, timeoutMs = REQUEST_TIMEOUT_MS) => {
    const headers = await getAuthHeaders(forceRefresh)
    const controller = new AbortController()
    const timeout =
      timeoutMs > 0
        ? setTimeout(() => controller.abort('request-timeout'), timeoutMs)
        : null
    try {
      return await fetch(`${BASE}/api/v1${path}`, {
        ...options,
        cache: 'no-store',
        credentials: 'include',
        headers: { ...headers, ...options.headers },
        signal: controller.signal,
      })
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }

  const initialTimeoutMs = method === 'GET' ? GET_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS
  const retryTimeoutMs = Math.max(initialTimeoutMs, RETRY_REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    res = await runRequest(false, initialTimeoutMs)
  } catch (error) {
    if (method === 'GET' && isTransientFetchError(error)) {
      await sleep(GET_RETRY_BACKOFF_MS)
      res = await runRequest(true, retryTimeoutMs)
    } else {
      throw error
    }
  }

  if (method === 'GET' && !res.ok && isTransientStatus(res.status)) {
    await sleep(GET_RETRY_BACKOFF_MS)
    res = await runRequest(true, retryTimeoutMs)
  }

  if (!res.ok) {
    if (method !== 'GET') {
      // A failed mutation can still change server state (e.g. idempotent endpoints).
      // Clear cached reads so admin pages don't keep stale status cards.
      clearApiCache()
    }
    let parsedError: any = null
    try {
      parsedError = await res.json()
    } catch {
      const rawText = await res.text().catch(() => '')
      parsedError = { detail: rawText || 'Unknown error' }
    }
    const detail = parsedError?.detail
    const detailMessage =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail
            .map((entry) => entry?.message ?? entry?.msg ?? entry?.detail)
            .filter(Boolean)
            .join(', ')
          : detail && typeof detail === 'object'
            ? detail.message ?? detail.error ?? null
            : null
    const rawMessage = String(detailMessage ?? parsedError?.message ?? `Request failed: ${res.status}`)
    throw new ApiRequestError(toUserFriendlyErrorMessage(rawMessage, res.status), res.status)
  }

  const json = (await res.json()) as T
  if (method !== 'GET') {
    // Avoid stale cross-page reads immediately after writes.
    clearApiCache()
  }
  return json
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = String(options.method ?? 'GET').toUpperCase()

  if (method !== 'GET' || GET_CACHE_TTL_MS <= 0) {
    return executeRequest<T>(path, options, method)
  }

  const cacheKey = `${method}:${path}`
  const now = Date.now()
  const cached = getResponseCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cached.data as T
  }

  const inflight = inFlightGetRequests.get(cacheKey)
  if (inflight) {
    return inflight as Promise<T>
  }

  const fetchPromise = executeRequest<T>(path, options, method)
    .then((data) => {
      getResponseCache.set(cacheKey, { data, expiresAt: Date.now() + GET_CACHE_TTL_MS })
      return data
    })
    .finally(() => {
      inFlightGetRequests.delete(cacheKey)
    })

  inFlightGetRequests.set(cacheKey, fetchPromise as Promise<unknown>)
  return fetchPromise
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const authApi = {
  me: () => request<APIResponse<UserRead>>('/auth/me'),
  sync: (body: { name?: string; phone?: string; role?: 'client' | 'cleaner'; experience?: number }) =>
    request<APIResponse<UserRead>>('/auth/sync', { method: 'POST', body: JSON.stringify(body) }),
}

export const googleCalendarApi = {
  getConnectUrl: (returnTo = '/cleaner/profile?tab=availability') =>
    request<APIResponse<{ url: string }>>(
      `/auth/google/connect?return_to=${encodeURIComponent(returnTo)}`,
    ),
  getStatus: () =>
    request<APIResponse<{ connected: boolean; calendar_id?: string | null; expires_at?: string | null }>>(
      '/auth/google/status',
    ),
  disconnect: () =>
    request<APIResponse<{ connected: boolean }>>('/auth/google/disconnect', { method: 'POST' }),
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const usersApi = {
  updateMe: (body: UserUpdate) =>
    request<APIResponse<UserRead>>('/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
}

export const phoneVerificationApi = {
  sendCode: (phone: string) =>
    request<APIResponse<{ sent: boolean }>>('/phone-verification/send', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  verifyCode: (phone: string, code: string) =>
    request<APIResponse<{ verified: boolean }>>('/phone-verification/check', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),
}

// ---------------------------------------------------------------------------
// Client Profile
// ---------------------------------------------------------------------------
export const clientsApi = {
  me: () => request<APIResponse<ClientProfileRead>>('/clients/me'),
  updateMe: (body: {
    name?: string
    phone?: string
    default_address?: string | null
    default_city?: string | null
    default_postcode?: string | null
    default_country?: string | null
  }) =>
    request<APIResponse<ClientProfileRead>>('/clients/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  listAddresses: () =>
    request<APIResponse<ClientAddressRead[]>>('/clients/addresses'),
  addAddress: (body: ClientAddressCreate) =>
    request<APIResponse<ClientAddressRead>>('/clients/addresses', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateAddress: (id: string, body: ClientAddressUpdate) =>
    request<APIResponse<ClientAddressRead>>(`/clients/addresses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteAddress: (id: string) =>
    request<APIResponse<{ removed: true }>>(`/clients/addresses/${id}`, {
      method: 'DELETE',
    }),
}

export const favoritesApi = {
  list: () =>
    request<APIResponse<FavoriteCleaner[]>>('/clients/favorites'),
  add: (cleanerId: string) =>
    request<APIResponse<{ favorite: true }>>('/clients/favorites', {
      method: 'POST',
      body: JSON.stringify({ cleaner_id: cleanerId }),
    }),
  remove: (cleanerId: string) =>
    request<APIResponse<{ favorite: false }>>(`/clients/favorites/${cleanerId}`, {
      method: 'DELETE',
    }),
}

// ---------------------------------------------------------------------------
// Cleaners
// ---------------------------------------------------------------------------
export const cleanersApi = {
  search: async (params: {
    city?: string
    availability?: 'any' | 'next_7_days'
    transport_mode?: 'own_car' | 'bus_walk' | 'requires_pickup'
    brings_own_supplies?: 'yes' | 'no'
    services_offered?: string
    min_rating?: number
    min_price?: number
    max_price?: number
    page?: number
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString()
    const res = await request<APIResponse<any>>(`/cleaners?${qs}`)
    return { ...res, data: normalizePaginated<CleanerSummary>(res.data ?? {}, 'cleaners') }
  },
  getById: (id: string) => request<APIResponse<CleanerRead>>(`/cleaners/${id}`),
  me: () =>
    request<APIResponse<{ cleaner: CleanerRead; onboarding: CleanerOnboardingProgress }>>('/cleaners/me'),
  updateMyProfile: (body: { bio?: string; years_experience?: number; hourly_rate: number }) =>
    request<APIResponse<CleanerRead>>('/cleaners/me', { method: 'PATCH', body: JSON.stringify(body) }),
  updateMyOnboarding: (body: Record<string, unknown>) =>
    request<APIResponse<{ cleaner: CleanerRead; onboarding: CleanerOnboardingProgress }>>('/cleaners/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  submitForApproval: () =>
    request<APIResponse<{ cleaner: CleanerRead; onboarding: CleanerOnboardingProgress }>>('/cleaners/me/submit', {
      method: 'POST',
    }),
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------
export const availabilityApi = {
  getMySchedule: () => request<APIResponse<any[]>>('/availability/me'),
  setMySchedule: (schedules: any[]) =>
    request<APIResponse<any[]>>('/availability/me', {
      method: 'PUT',
      body: JSON.stringify({ schedules }),
    }),
  getMyBlocked: () => request<APIResponse<any[]>>('/availability/me/blocked-list'),
  addBlocked: (body: { start_datetime: string; end_datetime: string; reason?: string }) =>
    request<APIResponse<any>>('/availability/me/blocked', { method: 'POST', body: JSON.stringify(body) }),
  deleteBlocked: (id: string) =>
    request<APIResponse<null>>(`/availability/me/blocked/${id}`, { method: 'DELETE' }),
  getSlots: (
    cleanerId: string,
    date: string,
    durationHours: number,
    options?: { excludeBookingId?: string },
  ) => {
    const qs = new URLSearchParams({ date, duration_hours: String(durationHours) })
    if (options?.excludeBookingId) qs.set('exclude_booking_id', options.excludeBookingId)
    return request<{ success: boolean; data: { start: string; end: string; disabled?: boolean }[] }>(
      `/availability/${cleanerId}/slots?${qs}`,
    )
  },
  getBookableDates: (cleanerId: string, durationHours: number, daysAhead = 28) => {
    const qs = new URLSearchParams({
      duration_hours: String(durationHours),
      days_ahead: String(daysAhead),
    })
    return request<{ success: boolean; data: string[] }>(
      `/availability/${cleanerId}/dates?${qs}`,
    )
  },
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
export const bookingsApi = {
  previewPrice: (cleanerId: string, durationHours: number) => {
    const qs = new URLSearchParams({ cleaner_id: cleanerId, duration_hours: String(durationHours) })
    return request<APIResponse<PriceBreakdown>>(`/bookings/preview-price?${qs}`)
  },
  create: (body: BookingCreate) =>
    request<APIResponse<BookingRead>>('/bookings', { method: 'POST', body: JSON.stringify(body) }),
  my: async (page = 1, status?: string) => {
    const qs = new URLSearchParams({ page: String(page) })
    if (status) qs.set('status', status)
    const res = await request<APIResponse<any>>(`/bookings?${qs.toString()}`)
    return { ...res, data: normalizePaginated<BookingRead>(res.data ?? {}, 'bookings') }
  },
  getById: (id: string) => request<APIResponse<BookingRead>>(`/bookings/${id}`),
  action: (
    id: string,
    action:
      | 'accept'
      | 'decline'
      | 'start'
      | 'propose_alternative'
      | 'counter_proposal'
      | 'accept_proposal'
      | 'decline_proposal'
      | 'amend_start_time',
    proposedStart?: string,
    startLocation?: {
      latitude: number
      longitude: number
      accuracy_m?: number
    },
  ) =>
    request<APIResponse<BookingRead>>(`/bookings/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        ...(proposedStart ? { proposed_start: proposedStart } : {}),
        ...(startLocation ? { start_location: startLocation } : {}),
      }),
    }),
  complete: (id: string) =>
    request<APIResponse<BookingRead>>(`/bookings/${id}/complete`, {
      method: 'POST',
    }),
  cancel: (id: string, reason: string) =>
    request<APIResponse<BookingRead>>(`/bookings/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  getFlowDraft: (cleanerId: string) =>
    request<APIResponse<BookingFlowDraftRead | null>>(`/bookings/draft?cleaner_id=${encodeURIComponent(cleanerId)}`),
  saveFlowDraft: (body: {
    cleaner_id: string
    booking_id?: string
    last_step: number
    duration_hours?: number
    selected_date?: string
    selected_slot?: string
    payload?: Record<string, any>
  }) =>
    request<APIResponse<BookingFlowDraftRead>>('/bookings/draft', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  clearFlowDraft: (cleanerId: string) =>
    request<APIResponse<{ removed: true }>>(`/bookings/draft?cleaner_id=${encodeURIComponent(cleanerId)}`, {
      method: 'DELETE',
    }),
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export const paymentsApi = {
  createIntent: (bookingId: string) =>
    request<APIResponse<PaymentIntentResponse>>('/payments/intent', {
      method: 'POST',
      body: JSON.stringify({ booking_id: bookingId }),
    }),
  createConnectOnboardLink: () =>
    request<APIResponse<{ url: string }>>('/payments/connect/onboard', { method: 'POST' }),
  createConnectDashboardLink: () =>
    request<APIResponse<{ url: string }>>('/payments/connect/dashboard', { method: 'POST' }),
  getConnectStatus: () =>
    request<APIResponse<{
      connected: boolean
      onboarded?: boolean
      charges_enabled: boolean
      payouts_enabled: boolean
      details_submitted?: boolean
      restricted_or_incomplete?: boolean
      requirements_currently_due?: string[]
      requirements_past_due?: string[]
      requirements_disabled_reason?: string | null
      stripe_account_id?: string
    }>>('/payments/connect/status'),
  syncAuthorization: (bookingId: string) =>
    request<APIResponse<{ payment_intent_status: string; payment_status: string; sync: any }>>(
      `/payments/sync/${bookingId}`,
      { method: 'POST' },
    ),
  listMethods: () =>
    request<APIResponse<Array<{
      id: string
      brand: string
      last4: string
      exp_month: number | null
      exp_year: number | null
    }>>>('/payments/methods'),
  deleteMethod: (paymentMethodId: string, replacementPaymentMethodId?: string) =>
    request<APIResponse<{ removed: boolean; replaced?: boolean; linked_bookings_reauthorised?: number }>>(
      `/payments/methods/${paymentMethodId}`,
      {
        method: 'DELETE',
        body: JSON.stringify(
          replacementPaymentMethodId
            ? { replacement_payment_method_id: replacementPaymentMethodId }
            : {},
        ),
      },
    ),
  createSetupIntent: () =>
    request<APIResponse<{ setup_intent_id: string; client_secret: string | null }>>('/payments/setup-intent', {
      method: 'POST',
    }),
  confirmWithSavedMethod: (bookingId: string, paymentMethodId: string) =>
    request<APIResponse<{ payment_intent_id: string; payment_intent_status: string; sync: any }>>(
      '/payments/confirm-existing',
      {
        method: 'POST',
        body: JSON.stringify({
          booking_id: bookingId,
          payment_method_id: paymentMethodId,
        }),
      },
    ),
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
export const reviewsApi = {
  create: (bookingId: string, body: ReviewCreate) =>
    request<APIResponse<ReviewRead>>(`/reviews/${bookingId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getForCleaner: async (cleanerId: string) => {
    const res = await request<APIResponse<any>>(`/reviews/cleaner/${cleanerId}`)
    return { ...res, data: (res.data?.reviews ?? res.data ?? []) as ReviewRead[] }
  },
  getForCleanerPaged: (cleanerId: string, page = 1, pageSize = 20) =>
    request<APIResponse<{ reviews: ReviewRead[]; total: number; page: number; page_size: number }>>(
      `/reviews/cleaner/${cleanerId}?page=${page}&page_size=${pageSize}`,
    ),
  replyToReview: (reviewId: string, response: string) =>
    request<APIResponse<ReviewRead>>(`/reviews/${reviewId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ response }),
    }),
}

// ---------------------------------------------------------------------------
// Messages (chat)
// ---------------------------------------------------------------------------
export const messagesApi = {
  getHistory: (bookingId: string) =>
    request<APIResponse<MessageRead[]>>(`/messages/${bookingId}`),
  send: (bookingId: string, content: string) =>
    request<APIResponse<MessageRead>>(`/messages/${bookingId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const notificationsApi = {
  list: async (params?: {
    page?: number
    page_size?: number
    unread_only?: boolean
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString()
    const res = await request<
      APIResponse<{ notifications: NotificationRead[]; total: number; page: number; page_size: number }>
    >(`/notifications${qs ? `?${qs}` : ''}`)
    const payload = res.data
    const notifications = (payload?.notifications ?? []).map((notification) => ({
      ...notification,
      archived: Boolean(notification?.data?._archived),
      archived_at:
        typeof notification?.data?._archived_at === 'string' ? notification.data._archived_at : null,
    }))
    return {
      ...res,
      data: {
        notifications,
        total: Number(payload?.total ?? notifications.length),
        page: Number(payload?.page ?? params?.page ?? 1),
        page_size: Number(payload?.page_size ?? params?.page_size ?? 20),
      },
    }
  },
  markAllRead: () =>
    request<APIResponse<null>>('/notifications/read-all', { method: 'PATCH' }),
  markRead: (id: string) =>
    request<APIResponse<null>>(`/notifications/${id}/read`, { method: 'PATCH' }),
  delete: (id: string) =>
    request<APIResponse<null>>(`/notifications/${id}`, { method: 'DELETE' }),
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export const adminApi = {
  getStats: () =>
    request<APIResponse<AdminStats>>('/admin/stats'),
  getOpsQueues: () =>
    request<APIResponse<AdminOpsQueues>>('/admin/ops-queues'),

  listUsers: async (params: { page?: number; role?: string; search?: string } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString()
    const res = await request<APIResponse<any>>(`/admin/users${qs ? `?${qs}` : ''}`)
    return { ...res, data: normalizePaginated<AdminUser>(res.data ?? {}, 'users') }
  },
  toggleUserActive: (id: string) =>
    request<APIResponse<{ id: string; is_active: boolean }>>(`/admin/users/${id}/toggle-active`, {
      method: 'PATCH',
    }),

  listCleaners: async (params: { page?: number; status?: string } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString()
    const res = await request<APIResponse<any>>(`/admin/cleaners${qs ? `?${qs}` : ''}`)
    return { ...res, data: normalizePaginated<AdminCleaner>(res.data ?? {}, 'cleaners') }
  },
  suspendCleaner: (id: string) =>
    request<APIResponse<{ id: string; status: string }>>(`/admin/cleaners/${id}/suspend`, {
      method: 'POST',
    }),
  approveCleaner: (
    id: string,
    action: 'approve' | 'reject',
    rejection_reason?: string,
    extras?: { rejection_reason_code?: string; rejection_custom_message?: string },
  ) =>
    request<APIResponse<CleanerRead>>(`/cleaners/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ action, rejection_reason, ...extras }),
    }),

  listBookings: async (params: { page?: number; page_size?: number; status?: string } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString()
    const res = await request<APIResponse<any>>(`/admin/bookings${qs ? `?${qs}` : ''}`)
    return { ...res, data: normalizePaginated<BookingRead>(res.data ?? {}, 'bookings') }
  },

  listDisputes: async () => {
    const res = await request<APIResponse<any>>('/disputes')
    const disputes = (res.data?.disputes ?? res.data ?? []) as AdminDispute[]
    return { ...res, data: disputes }
  },
  markDisputeUnderReview: (id: string) =>
    request<APIResponse<AdminDispute>>(`/disputes/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'under_review' }),
    }),
  resolveDispute: (id: string, body: {
    resolution_type: string
    resolution_note: string
    refund_amount?: number
    charge_percentage?: number
  }) =>
    request<APIResponse<AdminDispute>>(`/disputes/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}

// ---------------------------------------------------------------------------
// Client Disputes
// ---------------------------------------------------------------------------
export const disputesApi = {
  listMine: async (page = 1, pageSize = 20) => {
    const res = await request<APIResponse<any>>(`/disputes?page=${page}&page_size=${pageSize}`)
    return { ...res, data: normalizePaginated<ClientDispute>(res.data ?? {}, 'disputes') }
  },
  createForBooking: (
    bookingId: string,
    body: {
      issue_type: DisputeIssueType
      explanation: string
      evidence?: string[]
    },
  ) =>
    request<APIResponse<any>>(`/disputes/${bookingId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
