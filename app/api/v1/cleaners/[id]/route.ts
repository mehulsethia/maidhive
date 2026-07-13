import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { db } from '@/server/db'
import { ok, err } from '@/server/response'
import { isNewCleanerByCompletedJobs } from '@/lib/cleaner-badges'
import { cleanerReliabilityService } from '@/server/services/cleaner-reliability.service'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const cleaner = await cleanerRepo.findById(id)
  if (
    !cleaner ||
    cleaner.status !== 'approved' ||
    !cleaner.profileComplete ||
    !cleaner.stripeOnboardingComplete
  ) {
    return err('Cleaner not found', 404)
  }

  const [completedBookings, respondedBookings] = await Promise.all([
    db.booking.findMany({
      where: {
        cleanerId: cleaner.id,
        status: 'completed',
        payment: { is: { status: 'transferred' } },
      },
      select: {
        scheduledStart: true,
        startedAt: true,
      },
    }),
    db.booking.findMany({
      where: {
        cleanerId: cleaner.id,
        acceptedAt: { not: null },
      },
      select: {
        createdAt: true,
        acceptedAt: true,
      },
    }),
  ])
  const reviewAgg = await db.review.aggregate({
    where: { cleanerId: cleaner.id, isPublic: true },
    _avg: { rating: true },
  })

  const onTimeThresholdMs = 15 * 60 * 1000
  const onTimeCount = completedBookings.filter((booking) => {
    if (!booking.startedAt) return false
    return booking.startedAt.getTime() <= booking.scheduledStart.getTime() + onTimeThresholdMs
  }).length
  const onTimePercentage =
    completedBookings.length > 0 ? Math.round((onTimeCount / completedBookings.length) * 100) : 0

  const totalResponseMinutes = respondedBookings.reduce((sum, booking) => {
    if (!booking.acceptedAt) return sum
    const diffMs = booking.acceptedAt.getTime() - booking.createdAt.getTime()
    return sum + Math.max(diffMs, 0) / (60 * 1000)
  }, 0)
  const avgResponseMinutes =
    respondedBookings.length > 0 ? Math.round(totalResponseMinutes / respondedBookings.length) : 0
  const sanitizedUser = cleaner.user
    ? {
        id: cleaner.user.id,
        name: cleaner.user.name,
        avatarUrl: cleaner.user.avatarUrl,
        phone: null,
        email: null,
      }
    : cleaner.user

  const publicSuperCleanerEnabled =
    await cleanerReliabilityService.publicFeatureEnabled()
  const { reliabilitySnapshot: _privateReliability, ...publicCleaner } = cleaner

  return ok({
    ...publicCleaner,
    totalJobs: completedBookings.length,
    newCleanerBadge: isNewCleanerByCompletedJobs(completedBookings.length),
    averageRating:
      completedBookings.length >= 5 ? reviewAgg._avg.rating ?? null : null,
    user: sanitizedUser,
    ...cleanerReliabilityService.publicMetrics(
      cleaner.reliabilitySnapshot,
      publicSuperCleanerEnabled,
    ),
    avg_response_minutes: avgResponseMinutes,
  })
}
