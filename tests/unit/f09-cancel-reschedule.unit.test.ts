import { describe, expect, it } from 'vitest'
import { bookingActionSchema, cancelBookingSchema } from '@/server/schemas/booking.schema'
import { computeConfirmedCancellationPolicy, moneyFromCents } from '@/lib/cancellation-policy'
import { getCancellationPaymentOutcome } from '@/lib/booking-payment-outcome'
import type { BookingRead } from '@/types'

describe('F09 cancel/reschedule policy unit coverage', () => {
  it('UT-CANCEL-01 cancellation reason validator accepts optional reason and rejects >500 chars', () => {
    const valid = cancelBookingSchema.safeParse({ reason: 'Need to cancel due to travel change' })
    const invalid = cancelBookingSchema.safeParse({ reason: 'x'.repeat(501) })

    expect(valid.success).toBe(true)
    expect(invalid.success).toBe(false)
  })

  it('UT-CANCEL-02 cancellation validator accepts rest-of-today cleaner cancellation flag', () => {
    const valid = cancelBookingSchema.safeParse({
      reason: 'Cleaner unavailable today',
      cancel_rest_of_today: true,
    })

    expect(valid.success).toBe(true)
    expect(valid.data?.cancel_rest_of_today).toBe(true)
  })

  it('UT-CANCEL-02 reschedule/amend actions require proposed_start', () => {
    const amendMissing = bookingActionSchema.safeParse({ action: 'amend_start_time' })
    const proposeMissing = bookingActionSchema.safeParse({ action: 'propose_alternative' })

    expect(amendMissing.success).toBe(false)
    expect(proposeMissing.success).toBe(false)
  })

  it('UT-CANCEL-03 reschedule/amend actions accept valid proposed_start ISO datetime', () => {
    const amendValid = bookingActionSchema.safeParse({
      action: 'amend_start_time',
      proposed_start: '2026-06-15T09:30:00.000Z',
    })
    const counterValid = bookingActionSchema.safeParse({
      action: 'counter_proposal',
      proposed_start: '2026-06-16T12:00:00.000Z',
    })

    expect(amendValid.success).toBe(true)
    expect(counterValid.success).toBe(true)
  })

  it('UT-CANCEL-04 start action location payload enforces valid coordinate bounds', () => {
    const valid = bookingActionSchema.safeParse({
      action: 'start',
      start_location: { latitude: 34.91, longitude: 33.63, accuracy_m: 12 },
    })

    const invalid = bookingActionSchema.safeParse({
      action: 'start',
      start_location: { latitude: 123.45, longitude: 33.63 },
    })

    expect(valid.success).toBe(true)
    expect(invalid.success).toBe(false)
  })

  it('UT-CANCEL-05 under-12h client cancellation locks refund, cleaner compensation, and platform retention', () => {
    const policy = computeConfirmedCancellationPolicy({
      scheduledStart: '2026-06-15T10:00:00.000Z',
      cancelledAt: '2026-06-15T02:30:00.000Z',
      subtotal: 32,
      platformFee: 3.2,
      totalAmount: 35.2,
    })

    expect(policy?.window).toBe('under_12h')
    expect(moneyFromCents(policy?.clientRefundCents ?? 0)).toBe(17.6)
    expect(moneyFromCents(policy?.cleanerPayoutCents ?? 0)).toBe(16)
    expect(moneyFromCents(policy?.platformRetainedCents ?? 0)).toBe(1.6)
    expect(moneyFromCents(policy?.captureCents ?? 0)).toBe(17.6)
  })

  it('UT-CANCEL-06 cancellation payment outcome uses stored cleaner payout when refund metadata exists', () => {
    const cancelledBooking: BookingRead = {
      id: 'booking_cancelled_under_12',
      client_id: 'client_1',
      cleaner_id: 'cleaner_1',
      status: 'cancelled',
      service_type: 'standard',
      address: 'Address',
      city: 'Larnaca',
      postcode: '6015',
      scheduled_start: '2026-06-15T10:00:00.000Z',
      scheduled_end: '2026-06-15T12:00:00.000Z',
      duration_hours: 2,
      hourly_rate: 16,
      subtotal: 32,
      platform_fee: 3.2,
      total_amount: 35.2,
      cleaner_payout: 32,
      cancelled_at: '2026-06-15T02:30:00.000Z',
      created_at: '2026-06-14T10:00:00.000Z',
      payment: {
        id: 'payment_1',
        status: 'captured',
        amount: 35.2,
        refund_amount: 17.6,
        cleaner_payout: 16,
        platform_fee: 1.6,
      },
    }

    const outcome = getCancellationPaymentOutcome(cancelledBooking)

    expect(outcome?.releasedAmount).toBe(17.6)
    expect(outcome?.capturedAmount).toBe(17.6)
    expect(outcome?.cleanerPayoutDue).toBe(16)
    expect(outcome?.platformRetainedAmount).toBe(1.6)
  })

  it('UT-CANCEL-07 client cancellation policy overrides stale stored cleaner payout metadata', () => {
    const between12And24Hours: BookingRead = {
      id: 'booking_cancelled_between_12_24',
      client_id: 'client_1',
      cleaner_id: 'cleaner_1',
      status: 'cancelled',
      service_type: 'standard',
      address: 'Address',
      city: 'Larnaca',
      postcode: '6015',
      scheduled_start: '2026-06-15T10:00:00.000Z',
      scheduled_end: '2026-06-15T12:00:00.000Z',
      duration_hours: 2,
      hourly_rate: 16,
      subtotal: 32,
      platform_fee: 3.2,
      total_amount: 35.2,
      cleaner_payout: 32,
      cancellation_reason: 'Cancelled by client between 12 and 24 hours before scheduled start',
      cancelled_at: '2026-06-14T18:00:00.000Z',
      created_at: '2026-06-14T10:00:00.000Z',
      payment: {
        id: 'payment_between_12_24',
        status: 'transferred',
        amount: 35.2,
        refund_amount: 30.2,
        refund_reason: 'client_cancellation_policy',
        cleaner_payout: 5,
        platform_fee: 0,
      },
    }

    const under12Hours: BookingRead = {
      ...between12And24Hours,
      id: 'booking_cancelled_under_12_stale',
      scheduled_start: '2026-06-15T10:00:00.000Z',
      scheduled_end: '2026-06-15T11:30:00.000Z',
      subtotal: 24,
      platform_fee: 2.4,
      total_amount: 26.4,
      cleaner_payout: 24,
      cancellation_reason: 'Client requested cancellation',
      cancelled_at: '2026-06-15T02:30:00.000Z',
      payment: {
        id: 'payment_under_12_stale',
        status: 'captured',
        amount: 26.4,
        refund_amount: 13.2,
        refund_reason: 'client_cancellation_policy',
        cleaner_payout: 13.2,
        platform_fee: 0,
      },
    }

    const betweenOutcome = getCancellationPaymentOutcome(between12And24Hours)
    const underOutcome = getCancellationPaymentOutcome(under12Hours)

    expect(betweenOutcome?.capturedAmount).toBe(5)
    expect(betweenOutcome?.cleanerPayoutDue).toBe(0)
    expect(betweenOutcome?.platformRetainedAmount).toBe(5)
    expect(underOutcome?.capturedAmount).toBe(13.2)
    expect(underOutcome?.cleanerPayoutDue).toBe(12)
    expect(underOutcome?.platformRetainedAmount).toBe(1.2)
  })
})
