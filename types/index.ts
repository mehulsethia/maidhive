// ---------------------------------------------------------------------------
// Shared API envelope
// ---------------------------------------------------------------------------
export interface APIResponse<T> {
  success: boolean
  data?: T
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  has_next: boolean
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export interface UserRead {
  id: string
  email: string
  name: string
  phone?: string
  avatar_url?: string
  role: 'client' | 'cleaner' | 'admin'
  is_active: boolean
  created_at: string
}

export interface UserUpdate {
  name?: string
  phone?: string
  avatar_url?: string
}

// ---------------------------------------------------------------------------
// Cleaners
// ---------------------------------------------------------------------------
export interface CleanerRead {
  id: string
  user_id: string
  bio?: string
  years_experience: number
  hourly_rate: number
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  profile_complete: boolean
  identity_verified: boolean
  stripe_onboarding_complete: boolean
  stripe_account_id?: string
  total_jobs: number
  average_rating?: number
  created_at: string
}

export interface CleanerSummary {
  id: string
  user_id: string
  hourly_rate: number
  total_jobs: number
  average_rating?: number
  bio?: string
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'disputed'

export type ServiceType = 'standard' | 'deep_clean' | 'end_of_tenancy' | 'move_in'

export interface BookingCreate {
  cleaner_id: string
  service_type: ServiceType
  address: string
  city: string
  postcode: string
  country?: string
  scheduled_start: string  // ISO8601
  duration_hours: number
  special_instructions?: string
}

export interface BookingRead {
  id: string
  client_id: string
  cleaner_id: string
  status: BookingStatus
  service_type: ServiceType
  address: string
  city: string
  postcode: string
  scheduled_start: string
  scheduled_end: string
  duration_hours: number
  hourly_rate: number
  total_amount: number
  cleaner_payout: number
  platform_fee: number
  special_instructions?: string
  accept_by?: string
  pay_by?: string
  accepted_at?: string
  confirmed_at?: string
  completed_at?: string
  cancelled_at?: string
  cancellation_reason?: string
  created_at: string
}

export interface PriceBreakdown {
  hourly_rate: number
  duration_hours: number
  subtotal: number
  platform_fee_pct: number
  platform_fee: number
  cleaner_payout: number
  total_amount: number
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export interface PaymentIntentResponse {
  payment_intent_id: string
  client_secret: string
  amount: number
  currency: string
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
export interface ReviewCreate {
  rating: number
  comment?: string
}

export interface ReviewRead {
  id: string
  booking_id: string
  cleaner_id: string
  client_id: string
  rating: number
  comment?: string
  is_public: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
export interface MessageRead {
  id: string
  booking_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export interface NotificationRead {
  id: string
  type: string
  title: string
  body: string
  data?: Record<string, any>
  is_read: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export interface AdminStats {
  total_users: number
  total_cleaners: number
  total_clients: number
  pending_cleaners: number
  approved_cleaners: number
  suspended_cleaners: number
  total_bookings: number
  active_bookings: number
  completed_bookings: number
  open_disputes: number
  total_revenue: number
  platform_earnings: number
}

export interface AdminUser {
  id: string
  email: string
  name: string
  phone?: string
  role: 'client' | 'cleaner' | 'admin'
  is_active: boolean
  created_at: string
}

export interface AdminCleaner {
  id: string
  user_id: string
  user_name: string
  user_email: string
  user_phone?: string
  bio?: string
  years_experience: number
  hourly_rate: number
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  rejection_reason?: string
  profile_complete: boolean
  identity_verified: boolean
  stripe_onboarding_complete: boolean
  total_jobs: number
  average_rating?: number
  created_at: string
}

export interface AdminDispute {
  id: string
  booking_id: string
  raised_by: string
  reason: string
  status: 'open' | 'under_review' | 'resolved' | 'closed'
  resolution_type?: string
  resolution_note?: string
  refund_amount?: number
  resolved_at?: string
  created_at: string
}
