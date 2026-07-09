import { describe, expect, it } from 'vitest'
import { getNotificationHref } from '@/lib/notification-links'
import { normalizeNotificationCopyForRole } from '@/lib/notification-copy'

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

  it('routes a cleaner self-cancellation notification to that booking', () => {
    const notification: any = {
      type: 'booking_cancelled',
      data: { booking_id: 'booking_123' },
    }

    expect(getNotificationHref('cleaner', notification)).toBe('/cleaner/bookings/booking_123')
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

  it('UT-NOTIF-04 dispute notifications route to admin disputes and role report pages', () => {
    const notif: any = {
      type: 'dispute_under_review',
      data: { dispute_id: 'disp_1', booking_id: 'booking_1' },
    }

    expect(getNotificationHref('admin', notif)).toBe('/admin/disputes?dispute=disp_1')
    expect(getNotificationHref('client', notif)).toBe('/client/report?booking=booking_1')
    expect(getNotificationHref('cleaner', notif)).toBe('/cleaner/report?booking=booking_1')
  })

  it('routes dispute response notifications directly to the dispute case', () => {
    const notif: any = {
      type: 'dispute_response_submitted',
      data: { dispute_id: 'disp_1', booking_id: 'booking_1' },
    }

    expect(getNotificationHref('admin', notif)).toBe('/admin/disputes?dispute=disp_1')
    expect(getNotificationHref('client', notif)).toBe('/client/report?booking=booking_1')
  })

  it('UT-NOTIF-05 resolved disputes route admins to the related booking history', () => {
    const resolved: any = {
      type: 'dispute_resolved',
      data: { dispute_id: 'disp_1', booking_id: 'booking_1' },
    }

    expect(getNotificationHref('admin', resolved)).toBe('/admin/bookings/booking_1')
    expect(getNotificationHref('cleaner', resolved)).toBe('/cleaner/bookings/booking_1')
  })

  it('UT-NOTIF-06 client completed notifications hide cleaner payout release states', () => {
    const awaiting = normalizeNotificationCopyForRole('client', {
      title: 'Completed - Awaiting Release',
      body: 'Booking completed - awaiting release.',
    } as any)
    const released = normalizeNotificationCopyForRole('client', {
      title: 'Completed - Released',
      body: 'Your booking is Completed — Released.',
    } as any)

    expect(awaiting.title).toBe('Completed')
    expect(awaiting.body).toBe('Booking Completed.')
    expect(released.title).toBe('Completed')
    expect(released.body).toBe('Your booking is Completed.')
  })
})
