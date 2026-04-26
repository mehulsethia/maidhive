import { NextRequest } from 'next/server'
import { requireClient } from '@/server/auth'
import { clientRepo } from '@/server/repositories/client.repo'
import { stripe } from '@/server/stripe'
import { ok } from '@/server/response'

export const GET = requireClient(async (_req: NextRequest, _ctx, user) => {
  const client = await clientRepo.findByUserId(user.id)
  if (!client?.stripeCustomerId) return ok([])

  const paymentMethods = await stripe.paymentMethods.list({
    customer: client.stripeCustomerId,
    type: 'card',
  })

  return ok(
    paymentMethods.data.map((method) => ({
      id: method.id,
      brand: method.card?.brand ?? 'card',
      last4: method.card?.last4 ?? '0000',
      exp_month: method.card?.exp_month ?? null,
      exp_year: method.card?.exp_year ?? null,
    })),
  )
})
