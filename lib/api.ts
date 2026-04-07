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
  CleanerSummary,
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

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createClient()
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
    headers: { ...headers, ...options.headers },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail ?? `Request failed: ${res.status}`)
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
// Cleaners
// ---------------------------------------------------------------------------
export const cleanersApi = {
  search: (params: { city?: string; page?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString()
    return request<APIResponse<PaginatedResponse<CleanerSummary>>>(`/cleaners?${qs}`)
  },
  getById: (id: string) => request<APIResponse<CleanerRead>>(`/cleaners/${id}`),
  updateMyProfile: (body: { bio?: string; years_experience?: number; hourly_rate: number }) =>
    request<APIResponse<CleanerRead>>('/cleaners/me', { method: 'PATCH', body: JSON.stringify(body) }),
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------
export const availabilityApi = {
  getMySchedule: () => request<APIResponse<any[]>>('/availability/me'),
  setMySchedule: (body: any[]) =>
    request<APIResponse<any[]>>('/availability/me', { method: 'PUT', body: JSON.stringify(body) }),
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
  my: (page = 1) =>
    request<APIResponse<PaginatedResponse<BookingRead>>>(`/bookings/my?page=${page}`),
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
  getForCleaner: (cleanerId: string) =>
    request<APIResponse<ReviewRead[]>>(`/reviews/cleaner/${cleanerId}`),
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

  listUsers: (params: { page?: number; role?: string; search?: string } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString()
    return request<APIResponse<PaginatedResponse<AdminUser>>>(`/admin/users${qs ? `?${qs}` : ''}`)
  },
  toggleUserActive: (id: string) =>
    request<APIResponse<{ id: string; is_active: boolean }>>(`/admin/users/${id}/toggle-active`, {
      method: 'PATCH',
    }),

  listCleaners: (params: { page?: number; status?: string } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString()
    return request<APIResponse<PaginatedResponse<AdminCleaner>>>(`/admin/cleaners${qs ? `?${qs}` : ''}`)
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

  listBookings: (params: { page?: number; status?: string } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString()
    return request<APIResponse<PaginatedResponse<BookingRead>>>(`/admin/bookings${qs ? `?${qs}` : ''}`)
  },

  listDisputes: () =>
    request<APIResponse<AdminDispute[]>>('/disputes'),
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
