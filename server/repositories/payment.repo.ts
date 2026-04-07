import { db } from '../db'
import type { Prisma } from '@prisma/client'

export const paymentRepo = {
  findByBookingId: (bookingId: string) =>
    db.payment.findUnique({ where: { bookingId } }),

  findByStripeIntentId: (stripePaymentIntentId: string) =>
    db.payment.findUnique({ where: { stripePaymentIntentId } }),

  create: (data: {
    bookingId: string
    stripePaymentIntentId: string
    amount: number
    platformFee: number
    cleanerPayout: number
    currency?: string
  }) =>
    db.payment.create({ data }),

  update: (id: string, data: Prisma.PaymentUpdateInput) =>
    db.payment.update({ where: { id }, data }),

  updateByIntentId: (stripePaymentIntentId: string, data: Prisma.PaymentUpdateInput) =>
    db.payment.update({ where: { stripePaymentIntentId }, data }),
}
