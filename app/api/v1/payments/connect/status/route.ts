import { requireCleaner } from '@/server/auth'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { stripe } from '@/server/stripe'
import { ok, err } from '@/server/response'
import { pushInAppNotification } from '@/server/services/in-app-notification.service'

export const GET = requireCleaner(async (_req, _ctx, user) => {
  const cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner) return err('Cleaner profile not found', 404)

  if (!cleaner.stripeAccountId) {
    return ok({
      connected: false,
      onboarded: false,
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    })
  }

  const account = await stripe.accounts.retrieve(cleaner.stripeAccountId)
  const currentlyDue = account.requirements?.currently_due?.length ?? 0
  const pastDue = account.requirements?.past_due?.length ?? 0
  const hasDisabledReason = Boolean(account.requirements?.disabled_reason)
  const restrictedOrIncomplete = currentlyDue > 0 || pastDue > 0 || hasDisabledReason
  const connected =
    account.details_submitted &&
    account.charges_enabled &&
    account.payouts_enabled &&
    !restrictedOrIncomplete

  if (cleaner.stripeOnboardingComplete !== connected) {
    await cleanerRepo.update(cleaner.id, { stripeOnboardingComplete: connected })
    if (connected) {
      await pushInAppNotification({
        userId: user.id,
        type: 'stripe_connected',
        title: 'Stripe connected',
        body: 'Your payment setup is complete. Your profile is now live and visible to clients.',
        data: { cleaner_id: cleaner.id },
      })
    }
  }

  return ok({
    connected,
    onboarded: connected,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    details_submitted: account.details_submitted,
    restricted_or_incomplete: restrictedOrIncomplete,
    requirements_currently_due: account.requirements?.currently_due ?? [],
    requirements_past_due: account.requirements?.past_due ?? [],
    requirements_disabled_reason: account.requirements?.disabled_reason ?? null,
  })
})
