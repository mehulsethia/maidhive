import { requireAuth } from '@/server/auth'
import { db } from '@/server/db'
import { ok } from '@/server/response'

export const GET = requireAuth(async (_req, _ctx, user) => {
  const userId = user.id
  const role = user.role

  // Unread chat messages (messages in my bookings, sent by others, unread)
  const bookingFilter = role === 'cleaner'
    ? { cleaner: { userId } }
    : { client: { userId } }

  const unreadChats = await db.message.count({
    where: {
      isRead: false,
      senderId: { not: userId },
      booking: {
        ...bookingFilter,
        status: { in: ['confirmed', 'in_progress', 'completed', 'disputed'] },
      },
    },
  })

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
  } else {
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

  return ok({ unread_chats: unreadChats, pending_bookings: pendingBookings })
})
