import { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { disputeRepo } from '@/server/repositories/dispute.repo'
import { paymentRepo } from '@/server/repositories/payment.repo'
import { stripe } from '@/server/stripe'
import { ok, err } from '@/server/response'
import { resolveDisputeSchema } from '@/server/schemas/dispute.schema'

export const POST = requireAdmin(async (req: NextRequest, ctx, user) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = resolveDisputeSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const dispute = await disputeRepo.findById(id)
  if (!dispute) return err('Dispute not found', 404)
  if (dispute.status === 'resolved') return err('Dispute already resolved', 400)

  let stripeRefundId: string | undefined

  if (parsed.data.resolution_type === 'full_refund' || parsed.data.resolution_type === 'partial_refund') {
    const payment = await paymentRepo.findByBookingId(dispute.bookingId)
    if (payment && payment.stripePaymentIntentId) {
      const refundAmount =
        parsed.data.resolution_type === 'full_refund'
          ? undefined
          : parsed.data.refund_amount
            ? Math.round(parsed.data.refund_amount * 100)
            : undefined

      const refund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        ...(refundAmount ? { amount: refundAmount } : {}),
      })
      stripeRefundId = refund.id

      await paymentRepo.update(payment.id, {
        status: parsed.data.resolution_type === 'full_refund' ? 'refunded' : 'partially_refunded',
        stripeRefundId,
        refundAmount: parsed.data.refund_amount,
        refundReason: parsed.data.resolution_note,
        refundedAt: new Date(),
      })
    }
  }

  const updated = await disputeRepo.update(id, {
    status: 'resolved',
    resolutionType: parsed.data.resolution_type,
    resolutionNote: parsed.data.resolution_note,
    refundAmount: parsed.data.refund_amount,
    resolvedByUser: { connect: { id: user.id } },
    resolvedAt: new Date(),
  })

  return ok(updated)
})
