/**
 * Typed API client for the MaidHive FastAPI backend.
 * Every request attaches the Supabase JWT from the current session.
 */
import { createClient } from '@/lib/supabase'
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

type AnyObj = Record<string, any>

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
  const supabase = createClient()

  // getSession() can return stale/expired tokens from storage.
  // Call getUser() first — it validates against Supabase Auth and
  // triggers a token refresh when the access token has expired.
  const { error: userError } = await supabase.auth.getUser()
  if (userError) {
    // Session is gone or refresh failed — skip Bearer header.
    // The server cookie fallback may still authenticate the request.
    return { 'Content-Type': 'application/json' }
  }

  // After getUser() succeeds, getSession() returns the (possibly refreshed) session.
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
  return res.json() as Promise<T>
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
    return request<{ success: boolean; data: { start: string; end: string }[] }>(
      `/availability/${cleanerId}/slots?${qs}`,
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
  action: (id: string, action: 'accept' | 'start' | 'complete') =>
    request<APIResponse<BookingRead>>(`/bookings/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
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
  getConnectStatus: () =>
    request<APIResponse<{
      connected: boolean
      onboarded?: boolean
      charges_enabled: boolean
      payouts_enabled: boolean
      details_submitted?: boolean
      stripe_account_id?: string
    }>>('/payments/connect/status'),
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
    request<APIResponse<AdminDispute>>(`/disputes/${id}/status`, { method: 'PATCH' }),
  resolveDispute: (id: string, body: {
    resolution_type: string
    resolution_note: string
    refund_amount?: number | null
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
  createForBooking: (bookingId: string, body: { reason: string; evidence?: string[] }) =>
    request<APIResponse<any>>(`/disputes/${bookingId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
