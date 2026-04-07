import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'
import { ok } from '@/server/response'

export const GET = requireAdmin(async () => {
  const [totalUsers, totalCleaners, totalBookings, totalRevenue, openDisputes] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.cleaner.count({ where: { status: 'approved' } }),
    db.booking.count(),
    db.payment.aggregate({ _sum: { platformFee: true }, where: { status: { in: ['captured', 'transferred'] } } }),
    db.dispute.count({ where: { status: { not: 'closed' } } }),
  ])

  return ok({
    total_users: totalUsers,
    total_cleaners: totalCleaners,
    total_bookings: totalBookings,
    total_platform_revenue: Number(totalRevenue._sum.platformFee ?? 0),
    open_disputes: openDisputes,
  })
})
