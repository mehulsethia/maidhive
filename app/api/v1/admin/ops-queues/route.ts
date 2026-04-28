import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'
import { ok } from '@/server/response'
import { addUtcDays, endOfUtcDate, startOfUtcDate, todayUtcDateOnly } from '@/lib/datetime'

function bestEffortName(name?: string | null, email?: string | null): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  const emailLocal = email?.split('@')[0]?.trim()
  if (emailLocal) return emailLocal
  return 'Cleaner'
}

export const GET = requireAdmin(async () => {
  const today = todayUtcDateOnly()
  const tomorrow = addUtcDays(today, 1)
  const dayAfterTomorrow = addUtcDays(today, 2)

  const todayStart = startOfUtcDate(today)
  const todayEnd = endOfUtcDate(today)
  const tomorrowStart = startOfUtcDate(tomorrow)
  const tomorrowEnd = endOfUtcDate(tomorrow)
  const afterTomorrowStart = startOfUtcDate(dayAfterTomorrow)

  const [
    pendingCleaners,
    activeDisputes,
    pendingBookingRequests,
    todayJobs,
    tomorrowJobs,
    paymentIssues,
    failedPayments,
    cancelledBookings,
    noShowDisputes,
  ] =
    await Promise.all([
      db.cleaner.findMany({
        where: { status: 'pending' },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
        take: 10,
      }),
      db.dispute.findMany({
        where: { status: { in: ['open', 'under_review'] } },
        orderBy: { createdAt: 'asc' },
        take: 10,
      }),
      db.booking.findMany({
        where: {
          status: 'pending',
          acceptBy: { gte: new Date() },
        },
        include: { cleaner: { include: { user: true } }, client: { include: { user: true } } },
        orderBy: { acceptBy: 'asc' },
        take: 20,
      }),
      db.booking.findMany({
        where: {
          status: { in: ['accepted', 'confirmed', 'in_progress'] },
          scheduledStart: { gte: todayStart, lte: todayEnd },
        },
        include: { cleaner: { include: { user: true } }, client: { include: { user: true } } },
        orderBy: { scheduledStart: 'asc' },
        take: 20,
      }),
      db.booking.findMany({
        where: {
          status: { in: ['accepted', 'confirmed', 'in_progress'] },
          scheduledStart: { gte: tomorrowStart, lte: tomorrowEnd },
        },
        include: { cleaner: { include: { user: true } }, client: { include: { user: true } } },
        orderBy: { scheduledStart: 'asc' },
        take: 20,
      }),
      db.booking.findMany({
        where: {
          status: 'accepted',
          reauthorizationRequired: true,
        },
        include: {
          client: { include: { user: true } },
        },
        orderBy: { payBy: 'asc' },
        take: 15,
      }),
      db.payment.findMany({
        where: {
          status: 'failed',
          failedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        },
        include: {
          booking: { include: { client: { include: { user: true } } } },
        },
        orderBy: [{ failedAt: 'desc' }, { updatedAt: 'desc' }],
        take: 15,
      }),
      db.booking.findMany({
        where: {
          status: 'cancelled',
          cancelledAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { cancelledAt: 'desc' },
        take: 10,
      }),
      db.dispute.findMany({
        where: {
          OR: [
            { issueType: { in: ['cleaner_didnt_arrive', 'client_no_show'] } },
            { reason: { contains: 'no-show', mode: 'insensitive' } },
          ],
          createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

  const cancellationNoShowItems = [
    ...cancelledBookings.map((booking) => ({
      id: `cancel-${booking.id}`,
      category: 'cancellation' as const,
      booking_id: booking.id,
      status: booking.status,
      reason: booking.cancellationReason ?? 'Cancelled',
      occurred_at: (booking.cancelledAt ?? booking.updatedAt).toISOString(),
    })),
    ...noShowDisputes.map((dispute) => ({
      id: `noshow-${dispute.id}`,
      category: 'no_show' as const,
      booking_id: dispute.bookingId,
      status: dispute.status,
      reason: dispute.reason,
      occurred_at: dispute.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 12)

  return ok({
    pending_cleaner_approvals: {
      count: pendingCleaners.length,
      items: pendingCleaners.map((cleaner) => ({
        id: cleaner.id,
        profile_photo: cleaner.profileImageUrl,
        full_name: bestEffortName(cleaner.user?.name, cleaner.user?.email),
        years_experience: cleaner.yearsExperience,
        transport_method: cleaner.transportMode,
        supplies_status: cleaner.cleaningSupplies,
        cleaning_standards_completed: cleaner.standardsCompleted,
        quiz_passed: cleaner.quizPassed,
        trial_period_flag: cleaner.totalJobs < 10,
        submitted_at: cleaner.createdAt.toISOString(),
      })),
    },
    active_disputes: {
      count: activeDisputes.length,
      items: activeDisputes.map((dispute) => ({
        id: dispute.id,
        booking_id: dispute.bookingId,
        status: dispute.status,
        reason: dispute.reason,
        created_at: dispute.createdAt.toISOString(),
      })),
    },
    pending_booking_requests: {
      count: pendingBookingRequests.length,
      items: pendingBookingRequests.map((booking) => ({
        id: booking.id,
        status: booking.status,
        city: booking.city,
        scheduled_start: booking.scheduledStart.toISOString(),
        cleaner_name: bestEffortName(booking.cleaner.user?.name, booking.cleaner.user?.email),
        client_name: bestEffortName(booking.client.user?.name, booking.client.user?.email),
      })),
    },
    todays_jobs: {
      count: todayJobs.length,
      items: todayJobs.map((booking) => ({
        id: booking.id,
        status: booking.status,
        city: booking.city,
        scheduled_start: booking.scheduledStart.toISOString(),
        cleaner_name: bestEffortName(booking.cleaner.user?.name, booking.cleaner.user?.email),
        client_name: bestEffortName(booking.client.user?.name, booking.client.user?.email),
      })),
    },
    upcoming_jobs: {
      today_count: todayJobs.length,
      tomorrow_count: tomorrowJobs.length,
      today_items: todayJobs.map((booking) => ({
        id: booking.id,
        status: booking.status,
        city: booking.city,
        scheduled_start: booking.scheduledStart.toISOString(),
        cleaner_name: bestEffortName(booking.cleaner.user?.name, booking.cleaner.user?.email),
        client_name: bestEffortName(booking.client.user?.name, booking.client.user?.email),
      })),
      tomorrow_items: tomorrowJobs.map((booking) => ({
        id: booking.id,
        status: booking.status,
        city: booking.city,
        scheduled_start: booking.scheduledStart.toISOString(),
        cleaner_name: bestEffortName(booking.cleaner.user?.name, booking.cleaner.user?.email),
        client_name: bestEffortName(booking.client.user?.name, booking.client.user?.email),
      })),
    },
    payment_failures: {
      count: failedPayments.length,
      items: failedPayments.map((payment) => ({
        id: payment.id,
        booking_id: payment.bookingId,
        payment_status: payment.status,
        failed_at: payment.failedAt?.toISOString() ?? null,
        client_name: bestEffortName(payment.booking.client.user?.name, payment.booking.client.user?.email),
      })),
    },
    payment_issues: {
      count: paymentIssues.length,
      items: paymentIssues.map((booking) => ({
        id: booking.id,
        booking_id: booking.id,
        payment_status: 'reauthorization_required',
        failed_at: booking.payBy?.toISOString() ?? null,
        client_name: bestEffortName(booking.client.user?.name, booking.client.user?.email),
      })),
    },
    cancellations_no_shows: {
      count: cancellationNoShowItems.length,
      items: cancellationNoShowItems,
    },
    generated_at: new Date().toISOString(),
    _window_utc: {
      today_start: todayStart.toISOString(),
      today_end: todayEnd.toISOString(),
      tomorrow_start: tomorrowStart.toISOString(),
      tomorrow_end: tomorrowEnd.toISOString(),
      next_window_start: afterTomorrowStart.toISOString(),
    },
  })
})
