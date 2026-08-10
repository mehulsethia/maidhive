import { db } from '../db'
import type { Prisma } from '@prisma/client'

export const paymentRepo = {
  findByBookingId: (bookingId: string) =>
    db.payment.findUnique({ where: { bookingId } }),

  findByStripeIntentId: (stripePaymentIntentId: string) =>
    db.payment.findUnique({ where: { stripePaymentIntentId } }),

  findByStripeChargeId: (stripeChargeId: string) =>
    db.payment.findUnique({ where: { stripeChargeId } }),

  create: (data: {
    bookingId: string
    stripePaymentIntentId: string
    amount: number
    platformFee: number
    cleanerPayout: number
    currency?: 'eur'
  }) =>
    db.payment.create({ data }),

  upsert: (data: {
    bookingId: string
    stripePaymentIntentId: string
    amount: number
    platformFee: number
    cleanerPayout: number
    currency?: string
  }) =>
    db.payment.upsert({
      where: { bookingId: data.bookingId },
      create: data,
      update: {
        stripePaymentIntentId: data.stripePaymentIntentId,
        amount: data.amount,
        platformFee: data.platformFee,
        cleanerPayout: data.cleanerPayout,
        currency: data.currency ?? 'eur',
        status: 'pending',
        stripeChargeId: null,
        stripeTransferId: null,
        stripeTransferReversalId: null,
        stripeRefundId: null,
        transferAmount: null,
        refundAmount: null,
        refundReason: null,
        authorizedAt: null,
        capturedAt: null,
        transferredAt: null,
        transferReversedAmount: 0,
        transferReversedAt: null,
        transferReversalStatus: null,
        payoutScheduledAt: null,
        refundedAt: null,
        failedAt: null,
      },
    }),

  update: (id: string, data: Prisma.PaymentUpdateInput) =>
    db.payment.update({ where: { id }, data }),

  updateByIntentId: (stripePaymentIntentId: string, data: Prisma.PaymentUpdateInput) =>
    db.payment.update({ where: { stripePaymentIntentId }, data }),
}
