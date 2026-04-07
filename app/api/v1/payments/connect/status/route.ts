import { requireCleaner } from '@/server/auth'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { stripe } from '@/server/stripe'
import { ok, err } from '@/server/response'

export const GET = requireCleaner(async (_req, _ctx, user) => {
  const cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner) return err('Cleaner profile not found', 404)

  if (!cleaner.stripeAccountId) {
    return ok({ onboarded: false, charges_enabled: false })
  }

  const account = await stripe.accounts.retrieve(cleaner.stripeAccountId)
  return ok({
    onboarded: cleaner.stripeOnboardingComplete,
    charges_enabled: account.charges_enabled,
    details_submitted: account.details_submitted,
  })
})
