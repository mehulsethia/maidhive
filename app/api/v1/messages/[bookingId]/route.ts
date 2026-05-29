import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { messageRepo } from '@/server/repositories/message.repo'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { clientRepo } from '@/server/repositories/client.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok, err } from '@/server/response'
import { sendMessageSchema } from '@/server/schemas/message.schema'
import { canViewChatHistoryForBooking, getChatReadOnlyMessage, isChatReadOnly } from '@/lib/chat-window'

async function isParty(bookingId: string, userId: string, role: string) {
  const booking = await bookingRepo.findById(bookingId)
  if (!booking) return null
  if (role === 'client') {
    const client = await clientRepo.findByUserId(userId)
    return client && booking.clientId === client.id ? booking : null
  }
  if (role === 'cleaner') {
    const cleaner = await cleanerRepo.findByUserId(userId)
    return cleaner && booking.cleanerId === cleaner.id ? booking : null
  }
  return booking // admin
}

export const GET = requireAuth(async (_req, ctx, user) => {
  const { bookingId } = await ctx.params
  const clientRequestId = _req.headers.get('x-client-request-id') ?? null
  const browser = detectBrowserFamily(_req.headers.get('user-agent'))
  const booking = await isParty(bookingId, user.id, user.role)
  if (!booking) return err('Forbidden', 403)
  if (
    !canViewChatHistoryForBooking({
      status: booking.status,
      scheduled_end: booking.scheduledEnd,
      _count: booking._count,
    })
  ) {
    return err('Chat is unavailable for this booking.', 400)
  }

  await messageRepo.markReadForBooking(bookingId, user.id)
  const messages = await messageRepo.findByBookingId(bookingId)
  console.info('messages.thread.result', {
    clientRequestId,
    bookingId,
    userId: user.id,
    role: user.role,
    browser,
    count: messages.length,
  })
  return ok(messages)
})

export const POST = requireAuth(async (req: NextRequest, ctx, user) => {
  const { bookingId } = await ctx.params
  const clientRequestId = req.headers.get('x-client-request-id') ?? null
  const browser = detectBrowserFamily(req.headers.get('user-agent'))
  const booking = await isParty(bookingId, user.id, user.role)
  if (!booking) return err('Forbidden', 403)
  if (
    !canViewChatHistoryForBooking({
      status: booking.status,
      scheduled_end: booking.scheduledEnd,
      _count: booking._count,
    })
  ) {
    return err('Chat is unavailable for this booking.', 400)
  }
  if (isChatReadOnly(booking.scheduledEnd, Date.now(), booking.status)) {
    return err(getChatReadOnlyMessage(booking.status), 400)
  }

  const body = await req.json()
  const parsed = sendMessageSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const message = await messageRepo.send(bookingId, user.id, parsed.data.content)
  console.info('messages.thread.sent', {
    clientRequestId,
    bookingId,
    userId: user.id,
    role: user.role,
    browser,
    length: parsed.data.content.length,
  })
  return ok(message, 201)
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
