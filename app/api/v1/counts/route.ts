import { requireAuth } from '@/server/auth'
import { db } from '@/server/db'
import { ok } from '@/server/response'
import { notificationRepo } from '@/server/repositories/notification.repo'

export const GET = requireAuth(async (_req, _ctx, user) => {
  const clientRequestId = _req.headers.get('x-client-request-id') ?? null
  const browser = detectBrowserFamily(_req.headers.get('user-agent'))
  const userId = user.id
  const role = user.role
  const chatCutoff = new Date(Date.now() - 30 * 60 * 1000)

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
            scheduledEnd: { gte: chatCutoff },
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
        payment: {
          is: {
            status: { in: ['authorized', 'captured', 'transferred'] },
          },
        },
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

  const unreadNotifications =
    role === 'admin'
      ? await (async () => {
          const adminUsers = await db.user.findMany({
            where: { role: 'admin', isActive: true },
            select: { id: true },
          })
          const adminIds = adminUsers.map((u) => u.id)
          if (adminIds.length === 0) return 0
          return notificationRepo.countUnreadForUsers(adminIds)
        })()
      : await notificationRepo.countUnread(userId)

  if ((pendingBookings === 0 && unreadChats === 0) && unreadNotifications > 0 && role !== 'admin') {
    console.warn('counts.zero_operational_with_notifications', {
      clientRequestId,
      userId,
      role,
      browser,
      pendingBookings,
      unreadChats,
      unreadNotifications,
    })
  }

  console.info('counts.result', {
    clientRequestId,
    userId,
    role,
    browser,
    unreadChats,
    pendingBookings,
    unreadNotifications,
  })

  return ok({
    unread_chats: unreadChats,
    pending_bookings: pendingBookings,
    unread_notifications: unreadNotifications,
  })
})

function detectBrowserFamily(userAgent: string | null) {
  const ua = String(userAgent ?? '').toLowerCase()
  if (!ua) return 'unknown'
  if (ua.includes('edg/')) return 'edge'
  if (ua.includes('chrome/') && !ua.includes('edg/')) return 'chromium'
  if (ua.includes('safari/') && !ua.includes('chrome/')) return 'safari'
  if (ua.includes('firefox/')) return 'firefox'
  return 'other'
}
