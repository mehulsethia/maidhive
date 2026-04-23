import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { messageRepo } from '@/server/repositories/message.repo'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { clientRepo } from '@/server/repositories/client.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok, err } from '@/server/response'
import { sendMessageSchema } from '@/server/schemas/message.schema'
import { config } from '@/server/config'

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
  const booking = await isParty(bookingId, user.id, user.role)
  if (!booking) return err('Forbidden', 403)

  const messages = await messageRepo.findByBookingId(bookingId)
  return ok(messages)
})

export const POST = requireAuth(async (req: NextRequest, ctx, user) => {
  const { bookingId } = await ctx.params
  const booking = await isParty(bookingId, user.id, user.role)
  if (!booking) return err('Forbidden', 403)
  if (!['confirmed', 'in_progress', 'completed'].includes(booking.status)) {
    return err('Chat is only available for confirmed bookings', 400)
  }

  // Chat becomes read-only after the dispute window expires.
  const CHAT_CUTOFF_MS = config.DISPUTE_WINDOW_HOURS * 60 * 60 * 1000
  if (booking.scheduledEnd) {
    const cutoff = new Date(booking.scheduledEnd).getTime() + CHAT_CUTOFF_MS
    if (Date.now() > cutoff) {
      return err(
        `Chat is read-only after ${config.DISPUTE_WINDOW_HOURS} hours from the scheduled end time`,
        400,
      )
    }
  }

  const body = await req.json()
  const parsed = sendMessageSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const message = await messageRepo.send(bookingId, user.id, parsed.data.content)
  return ok(message, 201)
})
