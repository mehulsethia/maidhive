import { describe, expect, it } from 'vitest'
import { getNotificationHref } from '@/lib/notification-links'

describe('F13 Notifications + deep links unit coverage', () => {
  it('UT-NOTIF-01 booking notification types map to role-scoped booking detail routes', () => {
    const notification: any = {
      type: 'booking_request',
      data: { booking_id: 'booking_123' },
    }

    expect(getNotificationHref('client', notification)).toBe('/client/bookings/booking_123')
    expect(getNotificationHref('cleaner', notification)).toBe('/cleaner/bookings/booking_123')
    expect(getNotificationHref('admin', notification)).toBe('/admin/bookings/booking_123')
  })

  it('UT-NOTIF-02 malformed or missing context falls back to safe role default routes', () => {
    const missingBooking: any = { type: 'booking_confirmed', data: {} }
    const unknownType: any = { type: 'unknown_event', data: { booking_id: 12345 } }

    expect(getNotificationHref('client', missingBooking)).toBe('/client/bookings')
    expect(getNotificationHref('cleaner', unknownType)).toBe('/cleaner/dashboard')
    expect(getNotificationHref('admin', unknownType)).toBe('/admin/dashboard')
  })

  it('UT-NOTIF-03 cleaner approval notification deep-links to payments tab', () => {
    const approved: any = { type: 'cleaner_application_approved', data: {} }
    expect(getNotificationHref('cleaner', approved)).toBe('/cleaner/profile?tab=payments')
  })

  it('UT-NOTIF-04 dispute notifications route to admin disputes and role booking pages', () => {
    const notif: any = {
      type: 'dispute_under_review',
      data: { dispute_id: 'disp_1', booking_id: 'booking_1' },
    }

    expect(getNotificationHref('admin', notif)).toBe('/admin/disputes')
    expect(getNotificationHref('client', notif)).toBe('/client/bookings/booking_1')
  })
})
