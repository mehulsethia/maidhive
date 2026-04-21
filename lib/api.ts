/**
 * Typed API client for the MaidHive FastAPI backend.
 * Every request attaches the Supabase JWT from the current session.
 */
import { getAccessToken } from '@/lib/auth-cache'
import type {
  AdminCleaner,
  AdminDispute,
  AdminStats,
  AdminUser,
  APIResponse,
  BookingCreate,
  BookingRead,
  CleanerRead,
  CleanerOnboardingProgress,
  CleanerSummary,
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

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''
const GET_CACHE_TTL_MS = Number(process.env.NEXT_PUBLIC_API_CLIENT_CACHE_TTL_MS ?? 30000)

type AnyObj = Record<string, any>
type CachedResponse = { expiresAt: number; data: unknown }

const getResponseCache = new Map<string, CachedResponse>()
const inFlightGetRequests = new Map<string, Promise<unknown>>()

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

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export function clearApiCache() {
  getResponseCache.clear()
  inFlightGetRequests.clear()
}

async function executeRequest<T>(path: string, options: RequestInit, method: string): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...options,
    cache: 'no-store',
    credentials: 'include',
    headers: { ...headers, ...options.headers },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail ?? error.message ?? `Request failed: ${res.status}`)
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
  sync: (body: { name: string; phone?: string; role: 'client' | 'cleaner' }) =>
    request<APIResponse<UserRead>>('/auth/sync', { method: 'POST', body: JSON.stringify(body) }),
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const usersApi = {
  updateMe: (body: UserUpdate) =>
    request<APIResponse<UserRead>>('/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
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
}

// ---------------------------------------------------------------------------
// Cleaners
// ---------------------------------------------------------------------------
export const cleanersApi = {
  search: async (params: { city?: string; page?: number }) => {
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
  getSlots: (cleanerId: string, date: string, durationHours: number) => {
    const qs = new URLSearchParams({ date, duration_hours: String(durationHours) })
    return request<{ success: boolean; data: { start: string; end: string; disabled?: boolean }[] }>(
      `/availability/${cleanerId}/slots?${qs}`,
    )
  },
  getBookableDates: (cleanerId: string, durationHours: number, daysAhead = 30) => {
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
  my: async (page = 1) => {
    const res = await request<APIResponse<any>>(`/bookings?page=${page}`)
    return { ...res, data: normalizePaginated<BookingRead>(res.data ?? {}, 'bookings') }
  },
  getById: (id: string) => request<APIResponse<BookingRead>>(`/bookings/${id}`),
  action: (
    id: string,
    action:
      | 'accept'
      | 'start'
      | 'propose_alternative'
      | 'counter_proposal'
      | 'accept_proposal'
      | 'decline_proposal',
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
  respond: (bookingId: string, response: string) =>
    request<APIResponse<ReviewRead>>(`/reviews/${bookingId}/response`, {
      method: 'POST',
      body: JSON.stringify({ response }),
    }),
  getForCleaner: async (cleanerId: string) => {
    const res = await request<APIResponse<any>>(`/reviews/cleaner/${cleanerId}`)
    return { ...res, data: (res.data?.reviews ?? res.data ?? []) as ReviewRead[] }
  },
  getForCleanerPaged: (cleanerId: string, page = 1, pageSize = 20) =>
    request<APIResponse<{ reviews: ReviewRead[]; total: number; page: number; page_size: number }>>(
      `/reviews/cleaner/${cleanerId}?page=${page}&page_size=${pageSize}`,
    ),
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
  list: () => request<APIResponse<NotificationRead[]>>('/notifications'),
  markAllRead: () =>
    request<APIResponse<null>>('/notifications/read-all', { method: 'PATCH' }),
  markRead: (id: string) =>
    request<APIResponse<null>>(`/notifications/${id}/read`, { method: 'PATCH' }),
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export const adminApi = {
  getStats: () =>
    request<APIResponse<AdminStats>>('/admin/stats'),

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
  approveCleaner: (id: string, action: 'approve' | 'reject', rejection_reason?: string) =>
    request<APIResponse<CleanerRead>>(`/cleaners/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ action, rejection_reason }),
    }),

  listBookings: async (params: { page?: number; status?: string } = {}) => {
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
      issue_type: 'cleaner_didnt_arrive' | 'client_no_show' | 'service_not_completed' | 'property_damage_safety' | 'other_issue'
      explanation: string
      evidence?: string[]
    },
  ) =>
    request<APIResponse<any>>(`/disputes/${bookingId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
