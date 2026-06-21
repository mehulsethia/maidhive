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
  email_confirmed_at?: string | null
  name: string
  phone?: string
  phone_verified_at?: string | null
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

export interface ClientProfileRead {
  id: string
  user_id: string
  stripe_customer_id?: string
  default_address?: string
  default_city?: string
  default_postcode?: string
  default_country?: string
  id_file_name?: string | null
  id_file_url?: string | null
  id_submitted_at?: string | null
  created_at?: string
  total_spent?: number
  user?: UserRead
}

// ---------------------------------------------------------------------------
// Cleaners
// ---------------------------------------------------------------------------
export interface CleanerRead {
  id: string
  user_id: string
  bio?: string
  profile_image_url?: string
  skills?: string[]
  cleaning_supplies?: 'own_supplies' | 'client_supplies'
  years_experience: number
  hourly_rate: number
  transport_mode?: 'own_car' | 'bus_walk' | 'requires_pickup'
  transport_pickup_location?: string
  id_type?: 'passport' | 'national_id' | 'drivers_licence'
  id_file_name?: string
  id_file_url?: string
  pet_acceptance?: boolean
  pet_comfortable?: boolean | null
  work_eligibility_answer?: boolean | null
  work_eligibility_confirmed?: boolean
  terms_accepted?: boolean
  cleaning_standards_accepted?: boolean
  cleaning_quiz_score?: number | null
  cleaning_quiz_passed_at?: string | null
  standards_completed?: boolean
  quiz_passed?: boolean
  quiz_score?: number | null
  onboarding_step?: number
  onboarding_skipped_step3?: boolean
  onboarding_skipped_step4?: boolean
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  lifecycle_status?: 'pending_approval' | 'approved' | 'live' | 'rejected' | 'suspended'
  rejection_reason?: string
  profile_complete: boolean
  identity_verified: boolean
  stripe_onboarding_complete: boolean
  stripe_account_id?: string
  total_jobs: number
  new_cleaner_badge?: boolean
  average_rating?: number
  released_earnings?: number
  created_at: string
  user?: UserRead
  service_areas?: Array<{ city: string; postcode_prefix?: string; radius_km?: number }>
}

export interface CleanerSummary {
  id: string
  user_id: string
  hourly_rate: number
  total_jobs: number
  new_cleaner_badge?: boolean
  average_rating?: number
  years_experience?: number
  transport_mode?: 'own_car' | 'bus_walk' | 'requires_pickup'
  cleaning_supplies?: 'own_supplies' | 'client_supplies'
  on_time_percentage?: number
  avg_response_minutes?: number
  created_at?: string
  bio?: string
  skills?: string[]
  profile_image_url?: string
  user?: {
    id: string
    name: string
    email: string
    phone?: string
    avatar_url?: string
  }
  service_areas?: Array<{
    city: string
    postcode_prefix?: string
    radius_km?: number
  }>
}

export interface CleanerOnboardingProgress {
  completion_pct: number
  can_be_listed: boolean
  current_step: 1 | 2 | 3 | 4 | 5
  steps: {
    step1_basic_details: boolean
    step2_kyc: boolean
    step3_availability: boolean
    step4_stripe_setup: boolean
    step5_training: boolean
  }
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
export type BookingStatus =
  | 'draft'
  | 'pending'
  | 'accepted'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'declined'
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
  apartment_details?: string
  access_notes?: string
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
  apartment_details?: string
  access_notes?: string
  city: string
  postcode: string
  scheduled_start: string
  scheduled_end: string
  duration_hours: number
  hourly_rate: number
  subtotal?: number
  platform_fee_pct?: number
  total_amount: number
  cleaner_payout: number
  platform_fee: number
  special_instructions?: string
  accept_by?: string
  pay_by?: string
  proposed_start?: string
  proposed_end?: string
  proposal_by?: 'client' | 'cleaner' | null
  proposal_context?: 'pre_confirmation' | 'post_confirmation' | 'amend_start' | null
  proposal_expires_at?: string | null
  cleaner_proposals?: number
  client_proposals?: number
  post_cleaner_proposals?: number
  post_client_proposals?: number
  original_scheduled_start?: string | null
  reauthorization_required?: boolean
  reauthorization_grace_expires_at?: string | null
  accepted_at?: string
  confirmed_at?: string
  started_at?: string
  start_initiated_by?: 'cleaner' | 'system' | null
  completed_at?: string
  cancelled_by?: string | null
  cancelled_at?: string
  cancellation_reason?: string
  created_at: string
  updated_at?: string
  client?: {
    id: string
    id_file_url?: string | null
    id_file_name?: string | null
    id_submitted_at?: string | null
    user?: UserRead
  }
  cleaner?: {
    id: string
    user?: UserRead
    profile_image_url?: string
  }
  payment?: {
    id: string
    status: string
    amount?: number
    platform_fee?: number
    cleaner_payout?: number
    currency?: string
    refund_amount?: number | null
    refund_reason?: string | null
    authorized_at?: string | null
    captured_at?: string | null
    transferred_at?: string | null
    payout_scheduled_at?: string | null
    refunded_at?: string | null
    failed_at?: string | null
    created_at?: string
    updated_at?: string
  } | null
  review?: {
    id: string
    rating: number
    comment?: string
    created_at?: string
    updated_at?: string
  } | null
  dispute?: {
    id: string
    status: 'open' | 'under_review' | 'resolved' | 'closed'
    reason: string
    issue_type?: string | null
    reporter_role?: 'client' | 'cleaner' | 'admin' | null
    response_explanation?: string | null
    responder_role?: 'client' | 'cleaner' | 'admin' | null
    responded_at?: string | null
    resolution_type?: string | null
    resolution_note?: string | null
    resolved_at?: string | null
    created_at: string
    updated_at?: string
  } | null
}

export interface BookingFlowDraftRead {
  id: string
  clientId: string
  cleanerId: string
  bookingId?: string | null
  lastStep: number
  durationHours?: number | null
  selectedDate?: string | null
  selectedSlot?: string | null
  payload?: Record<string, any> | null
  createdAt: string
  updatedAt: string
  booking?: BookingRead | null
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

export interface ClientAddressRead {
  id: string
  label?: string | null
  address_line1: string
  city: string
  postcode: string
  country: string
  apartment_details?: string | null
  access_notes?: string
  latitude?: number | null
  longitude?: number | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface ClientAddressCreate {
  label?: string
  address_line1: string
  city: string
  postcode: string
  country?: string
  apartment_details?: string
  access_notes?: string
  latitude?: number
  longitude?: number
  is_default?: boolean
}

export interface ClientAddressUpdate {
  label?: string
  address_line1?: string
  city?: string
  postcode?: string
  country?: string
  apartment_details?: string
  access_notes?: string
  latitude?: number
  longitude?: number
  is_default?: boolean
}

export interface FavoriteCleaner {
  cleaner_id: string
  user_id: string
  hourly_rate: number
  total_jobs: number
  average_rating?: number | null
  review_count?: number
  years_experience?: number
  transport_mode?: 'own_car' | 'bus_walk' | 'requires_pickup'
  cleaning_supplies?: 'own_supplies' | 'client_supplies'
  created_at?: string
  bio?: string
  profile_image_url?: string
  user?: {
    id: string
    name: string
    avatar_url?: string
  }
  service_areas?: Array<{
    city: string
    postcode_prefix?: string
    radius_km?: number
  }>
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
  cleaner_reply?: string | null
  cleaner_reply_at?: string | null
  is_public: boolean
  created_at: string
  client?: {
    id: string
    user?: UserRead
  }
  booking?: {
    scheduled_start?: string
  }
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
  user_id?: string
  type: string
  title: string
  body: string
  data?: Record<string, any>
  is_read: boolean
  archived?: boolean
  archived_at?: string | null
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
  live_cleaners?: number
  rejected_cleaners?: number
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
  skills?: string[]
  years_experience: number
  hourly_rate: number
  transport_mode?: string
  id_type?: string
  id_file_name?: string
  id_file_url?: string
  profile_image_url?: string
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  lifecycle_status?: 'pending_approval' | 'approved' | 'live' | 'rejected' | 'suspended'
  rejection_reason?: string
  profile_complete: boolean
  identity_verified: boolean
  cleaning_supplies?: 'own_supplies' | 'client_supplies'
  cleaning_standards_accepted?: boolean
  standards_completed?: boolean
  quiz_passed?: boolean
  quiz_score?: number | null
  stripe_onboarding_complete: boolean
  trial_period_flag?: boolean
  total_jobs: number
  average_rating?: number
  created_at: string
}

export interface AdminOpsQueueItemCleanerApproval {
  id: string
  profile_photo?: string | null
  full_name: string
  years_experience: number
  transport_method?: string | null
  supplies_status?: string | null
  cleaning_standards_completed: boolean
  quiz_passed: boolean
  trial_period_flag: boolean
  submitted_at: string
}

export interface AdminOpsQueueItemDispute {
  id: string
  booking_id: string
  status: string
  queue_stage: 'open' | 'awaiting_response' | 'under_review' | null
  reason: string
  created_at: string
}

export interface AdminOpsQueueItemBooking {
  id: string
  status: string
  city: string
  scheduled_start: string
  cleaner_name: string
  client_name: string
}

export interface AdminOpsQueueItemPaymentIssue {
  id: string
  booking_id: string
  payment_status: string
  failed_at?: string | null
  client_name: string
}

export interface AdminOpsQueueItemCancellationNoShow {
  id: string
  category: 'cancellation' | 'no_show'
  booking_id: string
  status: string
  reason: string
  occurred_at: string
}

export interface AdminOpsQueues {
  pending_cleaner_approvals: {
    count: number
    items: AdminOpsQueueItemCleanerApproval[]
  }
  active_disputes: {
    count: number
    breakdown: {
      open: number
      awaiting_response: number
      under_review: number
    }
    items: AdminOpsQueueItemDispute[]
  }
  pending_booking_requests: {
    count: number
    items: AdminOpsQueueItemBooking[]
  }
  todays_jobs: {
    count: number
    items: AdminOpsQueueItemBooking[]
  }
  upcoming_jobs: {
    today_count: number
    tomorrow_count: number
    today_items: AdminOpsQueueItemBooking[]
    tomorrow_items: AdminOpsQueueItemBooking[]
  }
  payment_failures: {
    count: number
    items: AdminOpsQueueItemPaymentIssue[]
  }
  payment_issues: {
    count: number
    items: AdminOpsQueueItemPaymentIssue[]
  }
  cancellations_no_shows: {
    count: number
    items: AdminOpsQueueItemCancellationNoShow[]
  }
  generated_at: string
}

export interface AdminDispute {
  id: string
  booking_id: string
  raised_by: string
  reason: string
  issue_type?: string
  explanation?: string
  evidence?: string[] | null
  reporter_role?: 'client' | 'cleaner' | 'admin' | null
  booking_status_at_report?: string | null
  response_explanation?: string | null
  response_evidence?: string[] | null
  responded_by?: string | null
  responder_role?: 'client' | 'cleaner' | 'admin' | null
  responded_at?: string | null
  status: 'open' | 'under_review' | 'resolved' | 'closed'
  resolution_type?: string
  resolution_note?: string
  refund_amount?: number
  resolved_at?: string
  created_at: string
  booking?: {
    client?: { user?: Pick<UserRead, 'name'> | null } | null
    cleaner?: { user?: Pick<UserRead, 'name'> | null } | null
  } | null
}

export interface ClientDispute {
  id: string
  booking_id: string
  raised_by: string
  reason: string
  issue_type?: string
  explanation?: string
  evidence?: string[] | null
  reporter_role?: 'client' | 'cleaner' | 'admin' | null
  booking_status_at_report?: string | null
  response_explanation?: string | null
  response_evidence?: string[] | null
  responded_by?: string | null
  responder_role?: 'client' | 'cleaner' | 'admin' | null
  responded_at?: string | null
  status: 'open' | 'under_review' | 'resolved' | 'closed'
  resolution_type?: string
  refund_amount?: number
  resolved_at?: string
  created_at: string
  booking?: BookingRead
}
