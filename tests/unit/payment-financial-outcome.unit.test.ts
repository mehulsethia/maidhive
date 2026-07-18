import { describe, expect, it } from 'vitest'
import {
  getBookingFinancialOutcome,
  getCleanerTransferLifecycleLabel,
  getResolutionFinancialPreview,
} from '@/lib/payment-financial-outcome'

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
      financialStatus: 'Refund issued',
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

  it('summarizes released authorisations as no captured client payment', () => {
    const outcome = getBookingFinancialOutcome({
      total_amount: 33,
      platform_fee: 3,
      cleaner_payout: 30,
      payment: {
        status: 'released',
        amount: 33,
        platform_fee: 0,
        cleaner_payout: 0,
      },
    })

    expect(outcome).toMatchObject({
      financialStatus: 'Payment authorisation released',
      finalClientAmountPaid: 0,
      finalCleanerPayout: 0,
      finalMaidHiveRetainedFee: 0,
    })
  })

  it('previews the mandatory full-refund outcome and allows reversible transferred payouts', () => {
    const preview = getResolutionFinancialPreview({
      total_amount: 22,
      platform_fee: 2,
      cleaner_payout: 20,
      payment: {
        status: 'transferred',
        amount: 22,
        cleaner_payout: 20,
        transferred_at: '2026-07-14T16:38:00.000Z',
        stripe_transfer_id: 'tr_123',
      },
    }, 'full_refund')

    expect(preview).toMatchObject({
      originalClientPayment: 22,
      refundToClient: 22,
      finalClientAmountPaid: 0,
      finalCleanerPayout: 0,
      finalMaidHiveRetainedFee: 0,
      cleanerPayoutTransferred: true,
      transferCanBeReversed: true,
      canSafelyApply: true,
    })
    expect(preview.safetyMessage).toContain('will attempt to reverse')
  })

  it('blocks a transferred refund preview when no Stripe transfer id is recorded', () => {
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
      cleanerPayoutTransferred: true,
      transferCanBeReversed: false,
      canSafelyApply: false,
    })
    expect(preview.safetyMessage).toContain('no Stripe Connect transfer id')
  })

  it('labels transfer lifecycle states from payment reversal fields', () => {
    expect(getCleanerTransferLifecycleLabel(null)).toBe('Not transferred')
    expect(getCleanerTransferLifecycleLabel({
      status: 'transferred',
      cleaner_payout: 20,
      stripe_transfer_id: 'tr_123',
    })).toBe('Transferred')
    expect(getCleanerTransferLifecycleLabel({
      status: 'refunded',
      cleaner_payout: 0,
      stripe_transfer_id: 'tr_123',
      transfer_amount: 20,
      transfer_reversed_amount: 20,
      transfer_reversed_at: '2026-07-14T16:40:00.000Z',
      transfer_reversal_status: 'succeeded',
    })).toBe('Reversed')
    expect(getCleanerTransferLifecycleLabel({
      status: 'transferred',
      cleaner_payout: 5,
      stripe_transfer_id: 'tr_123',
      transfer_amount: 20,
      transfer_reversed_amount: 15,
      transfer_reversal_status: 'succeeded',
    })).toBe('Partially reversed')
  })
})
