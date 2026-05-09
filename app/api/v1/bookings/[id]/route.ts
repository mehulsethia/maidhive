import { requireAuth } from '@/server/auth'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { clientRepo } from '@/server/repositories/client.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { sanitizeBookingForRole } from '@/server/services/booking-visibility.service'
import { ok, err } from '@/server/response'

export const GET = requireAuth(async (_req, ctx, user) => {
  const { id } = await ctx.params
  const booking = await bookingRepo.findById(id)
  if (!booking) return err('Booking not found', 404)

  const client = await clientRepo.findByUserId(user.id)
  const cleaner = await cleanerRepo.findByUserId(user.id)
  const isParty =
    (client && booking.clientId === client.id) ||
    (cleaner && booking.cleanerId === cleaner.id) ||
    user.role === 'admin'

  if (!isParty) return err('Forbidden', 403)

  if (
    user.role === 'cleaner' &&
    booking.status === 'cancelled' &&
    (
      !booking.payment ||
      !['authorized', 'captured', 'transferred'].includes(String(booking.payment.status ?? ''))
    )
  ) {
    return err('Booking not found', 404)
  }

  return ok(sanitizeBookingForRole(booking as any, user.role as 'client' | 'cleaner' | 'admin'))
})
