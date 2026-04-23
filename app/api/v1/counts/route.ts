import { requireAuth } from '@/server/auth'
import { db } from '@/server/db'
import { ok } from '@/server/response'
import { notificationRepo } from '@/server/repositories/notification.repo'

export const GET = requireAuth(async (_req, _ctx, user) => {
  const userId = user.id
  const role = user.role

  // Unread chat messages (messages in my bookings, sent by others, unread)
  const bookingFilter =
    role === 'cleaner'
      ? { cleaner: { userId } }
      : role === 'client'
        ? { client: { userId } }
        : null

  const unreadChats = bookingFilter
    ? await db.message.count({
        where: {
          isRead: false,
          senderId: { not: userId },
          booking: {
            ...bookingFilter,
            status: { in: ['confirmed', 'in_progress', 'completed', 'disputed'] },
          },
        },
      })
    : 0

  // Booking badge count
  let pendingBookings = 0
  if (role === 'cleaner') {
    // Cleaner: new incoming bookings awaiting accept
    pendingBookings = await db.booking.count({
      where: {
        cleaner: { userId },
        status: 'pending',
      },
    })
  } else if (role === 'client') {
    // Client: bookings recently accepted (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    pendingBookings = await db.booking.count({
      where: {
        client: { userId },
        status: 'accepted',
        acceptedAt: { gte: sevenDaysAgo },
      },
    })
  }

  const unreadNotifications = await notificationRepo.countUnread(userId)

  return ok({
    unread_chats: unreadChats,
    pending_bookings: pendingBookings,
    unread_notifications: unreadNotifications,
  })
})
