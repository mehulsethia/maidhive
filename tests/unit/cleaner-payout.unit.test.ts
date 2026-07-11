import { describe, expect, it } from 'vitest'
import { getCleanerPayoutSummary } from '@/lib/cleaner-payout'
import type { BookingRead } from '@/types'

function booking(overrides: Partial<BookingRead>): BookingRead {
  return {
    id: 'booking_1',
    client_id: 'client_1',
    cleaner_id: 'cleaner_1',
    status: 'completed',
    service_type: 'standard',
    address: 'Addr',
    city: 'Larnaca',
    postcode: '6015',
    scheduled_start: new Date('2026-05-10T08:00:00.000Z').toISOString(),
    scheduled_end: new Date('2026-05-10T10:00:00.000Z').toISOString(),
    duration_hours: 2,
    hourly_rate: 12,
    total_amount: 26.4,
    cleaner_payout: 24,
    platform_fee: 2.4,
    created_at: new Date('2026-05-09T10:00:00.000Z').toISOString(),
    ...overrides,
  }
}

describe('Cleaner payout summary', () => {
  it('deducts partial dispute refund from original cleaner payout', () => {
    const summary = getCleanerPayoutSummary(booking({
      payment: {
        id: 'payment_1',
        status: 'transferred',
        cleaner_payout: 24,
        refund_amount: 8,
      },
      dispute: {
        id: 'dispute_1',
        status: 'resolved',
        reason: 'Partial service issue',
        resolution_type: 'partial_refund',
        refund_amount: 8,
        created_at: new Date().toISOString(),
      },
    }))

    expect(summary).toMatchObject({
      originalCleanerPayout: 24,
      disputeAdjustment: -8,
      finalCleanerPayout: 16,
      refundAmount: 8,
      hasDisputeAdjustment: true,
    })
  })
})
