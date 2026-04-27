import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { userRepo } from '@/server/repositories/user.repo'
import { clientRepo } from '@/server/repositories/client.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { loopsEmailService } from '@/server/services/loops-email.service'
import { pushInAppNotification } from '@/server/services/in-app-notification.service'
import { ok } from '@/server/response'
import { syncUserSchema } from '@/server/schemas/user.schema'

export const POST = requireAuth(async (req: NextRequest, _ctx, user) => {
  const body = await req.json().catch(() => ({}))
  const parsed = syncUserSchema.safeParse(body)
  const data = parsed.success ? parsed.data : {}

  // Keep user profile fields in sync for newly-created sessions.
  if (data.name || data.phone) {
    await userRepo.update(user.id, {
      ...(data.name ? { name: data.name } : {}),
      ...(data.phone ? { phone: data.phone } : {}),
    })
  }

  // Ensure role-specific profile exists
  if (user.role === 'client') {
    const existing = await clientRepo.findByUserId(user.id)
    if (!existing) {
      await clientRepo.create(user.id)
      await pushInAppNotification({
        userId: user.id,
        type: 'account_created',
        title: 'Welcome to MaidHive',
        body: 'Your client profile is ready. Start by browsing available cleaners.',
      })
      try {
        await loopsEmailService.sendClientAccountCreated({
          email: user.email,
          fullName: user.name ?? data.name ?? 'Client',
        })
      } catch (emailError) {
        console.error('Failed to send client account created email via Loops:', emailError)
      }
    }
  } else if (user.role === 'cleaner') {
    let existing = await cleanerRepo.findByUserId(user.id)
    if (!existing) {
      await cleanerRepo.create(user.id)
      existing = await cleanerRepo.findByUserId(user.id)
      await pushInAppNotification({
        userId: user.id,
        type: 'account_created',
        title: 'Welcome to MaidHive',
        body: 'Your cleaner profile is created. Complete onboarding to start receiving jobs.',
      })
      try {
        await loopsEmailService.sendCleanerSignup({
          email: user.email,
          fullName: user.name ?? data.name ?? 'Cleaner',
        })
      } catch (emailError) {
        console.error('Failed to send cleaner signup email via Loops:', emailError)
      }
    }

    if (existing && data.experience !== undefined) {
      await cleanerRepo.update(existing.id, { yearsExperience: data.experience })
    }
  }

  const updated = await userRepo.findById(user.id)
  return ok(updated)
})
