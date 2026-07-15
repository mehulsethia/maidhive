import { describe, expect, it } from 'vitest'
import { getBookingFinancialOutcome, getResolutionFinancialPreview } from '@/lib/payment-financial-outcome'

describe('payment financial outcome', () => {
  it('summarizes a fully refunded completed booking with zero final retained fee', () => {
    const outcome = getBookingFinancialOutcome({
      total_amount: 22,
      platform_fee: 2,
      cleaner_payout: 20,
      payment: {
        status: 'refunded',
        amount: 22,
        platform_fee: 0,
        cleaner_payout: 0,
        refund_amount: 22,
      },
      dispute: {
        status: 'resolved',
        resolution_type: 'full_refund',
        refund_amount: 22,
      },
    })

    expect(outcome).toMatchObject({
      financialStatus: 'Fully refunded',
      originalClientPayment: 22,
      originalCleanerPayout: 20,
      originalPlatformFee: 2,
      refundToClient: 22,
      finalClientAmountPaid: 0,
      finalCleanerPayout: 0,
      finalMaidHiveRetainedFee: 0,
      isFullyRefunded: true,
    })
  })

  it('previews the mandatory full-refund outcome and blocks transferred payouts', () => {
    const preview = getResolutionFinancialPreview({
      total_amount: 22,
      platform_fee: 2,
      cleaner_payout: 20,
      payment: {
        status: 'transferred',
        amount: 22,
        cleaner_payout: 20,
        transferred_at: '2026-07-14T16:38:00.000Z',
      },
    }, 'full_refund')

    expect(preview).toMatchObject({
      originalClientPayment: 22,
      refundToClient: 22,
      finalClientAmountPaid: 0,
      finalCleanerPayout: 0,
      finalMaidHiveRetainedFee: 0,
      cleanerPayoutTransferred: true,
      canSafelyApply: false,
    })
    expect(preview.safetyMessage).toContain('already been transferred')
  })
})
