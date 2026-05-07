import { NextRequest } from 'next/server'
import { requireAuth, requireClient } from '@/server/auth'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { clientRepo } from '@/server/repositories/client.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { bookingService, ServiceError } from '@/server/services/booking.service'
import { sanitizeBookingsForRole } from '@/server/services/booking-visibility.service'
import { ok, err } from '@/server/response'
import { createBookingSchema, myBookingsQuerySchema } from '@/server/schemas/booking.schema'

// GET /api/v1/bookings/my — list user's bookings (client or cleaner)
export const GET = requireAuth(async (req: NextRequest, _ctx, user) => {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = myBookingsQuerySchema.safeParse(params)
  if (!parsed.success) return err(parsed.error.message, 422)

  const { page, page_size, status } = parsed.data

  if (user.role === 'client') {
    let client = await clientRepo.findByUserId(user.id)
    if (!client) client = await clientRepo.create(user.id)
    const [bookings, total] = await bookingRepo.findByClient(client.id, { page, pageSize: page_size, status })
    return ok({ bookings, total, page, page_size })
  }

  if (user.role === 'cleaner') {
    let cleaner = await cleanerRepo.findByUserId(user.id)
    if (!cleaner) cleaner = await cleanerRepo.create(user.id)
    const [bookings, total] = await bookingRepo.findByCleaner(cleaner.id, { page, pageSize: page_size, status })
    return ok({ bookings: sanitizeBookingsForRole(bookings as any[], 'cleaner'), total, page, page_size })
  }

  return err('Forbidden', 403)
})

// POST /api/v1/bookings — create booking
export const POST = requireClient(async (req: NextRequest, _ctx, user) => {
  try {
    const body = await req.json()
    const parsed = createBookingSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.message, 422)

    const booking = await bookingService.create(user, parsed.data)
    return ok(booking, 201)
  } catch (e) {
    if (e instanceof ServiceError) return err(e.message, e.status)
    const message = e instanceof Error ? e.message : String(e)
    if (message.includes('no_overlapping_bookings') || message.includes('23P01')) {
      return err('This time is no longer available. Please choose another time.', 409)
    }
    console.error('bookings.create failed', { message })
    return err(
      message
        ? `Unable to create booking draft: ${message}`
        : 'Unable to create booking draft right now. Please try again.',
      500,
    )
  }
})
