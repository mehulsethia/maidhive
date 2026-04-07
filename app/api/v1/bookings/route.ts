import { NextRequest } from 'next/server'
import { requireAuth, requireClient } from '@/server/auth'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { clientRepo } from '@/server/repositories/client.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { bookingService, ServiceError } from '@/server/services/booking.service'
import { ok, err } from '@/server/response'
import { createBookingSchema, myBookingsQuerySchema } from '@/server/schemas/booking.schema'

// GET /api/v1/bookings/my — list user's bookings (client or cleaner)
export const GET = requireAuth(async (req: NextRequest, _ctx, user) => {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = myBookingsQuerySchema.safeParse(params)
  if (!parsed.success) return err(parsed.error.message, 422)

  const { page, page_size, status } = parsed.data

  if (user.role === 'client') {
    const client = await clientRepo.findByUserId(user.id)
    if (!client) return err('Client profile not found', 404)
    const [bookings, total] = await bookingRepo.findByClient(client.id, { page, pageSize: page_size, status })
    return ok({ bookings, total, page, page_size })
  }

  if (user.role === 'cleaner') {
    const cleaner = await cleanerRepo.findByUserId(user.id)
    if (!cleaner) return err('Cleaner profile not found', 404)
    const [bookings, total] = await bookingRepo.findByCleaner(cleaner.id, { page, pageSize: page_size, status })
    return ok({ bookings, total, page, page_size })
  }

  return err('Forbidden', 403)
})

// POST /api/v1/bookings — create booking
export const POST = requireClient(async (req: NextRequest, _ctx, user) => {
  const body = await req.json()
  const parsed = createBookingSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  try {
    const booking = await bookingService.create(user, parsed.data)
    return ok(booking, 201)
  } catch (e) {
    if (e instanceof ServiceError) return err(e.message, e.status)
    throw e
  }
})
