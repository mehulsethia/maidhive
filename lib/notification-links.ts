import type { NotificationRead } from '@/types'

type UserRole = 'client' | 'cleaner' | 'admin'

function bookingDetailBase(role: UserRole) {
  if (role === 'cleaner') return '/cleaner/bookings'
  if (role === 'admin') return '/admin/bookings'
  return '/client/bookings'
}

export function getNotificationHref(role: UserRole, notification: NotificationRead) {
  const bookingId = notification.data?.booking_id as string | undefined
  const disputeId = notification.data?.dispute_id as string | undefined

  switch (notification.type) {
    case 'booking_request':
    case 'booking_created_pending':
    case 'booking_accepted':
    case 'booking_started':
    case 'booking_proposed_new_time':
    case 'booking_counter_proposal':
    case 'booking_time_agreed':
    case 'booking_request_declined':
    case 'booking_request_expired':
    case 'booking_cancelled':
    case 'booking_completed':
    case 'booking_confirmed':
    case 'payment_captured':
    case 'payment_transferred':
    case 'payout_released':
      return bookingId ? `${bookingDetailBase(role)}/${bookingId}` : bookingDetailBase(role)
    case 'dispute_raised':
    case 'dispute_under_review':
    case 'dispute_resolved':
      if (role === 'admin') return '/admin/disputes'
      if (role === 'cleaner') return disputeId ? `/cleaner/bookings/${bookingId ?? ''}` : '/cleaner/bookings'
      return disputeId ? `/client/bookings/${bookingId ?? ''}` : '/client/bookings'
    case 'cleaner_application_submitted':
    case 'cleaner_application_approved':
    case 'cleaner_application_rejected':
      if (role === 'admin') return '/admin/cleaners'
      if (role === 'cleaner') {
        return notification.type === 'cleaner_application_approved'
          ? '/cleaner/profile?tab=payments'
          : '/cleaner/profile'
      }
      return '/cleaner/profile'
    case 'account_created':
      return role === 'admin' ? '/admin/users' : role === 'cleaner' ? '/cleaner/profile' : '/client/cleaners'
    default:
      if (role === 'admin') return '/admin/dashboard'
      if (role === 'cleaner') return '/cleaner/dashboard'
      return '/client/dashboard'
  }
}
