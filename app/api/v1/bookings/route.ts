import { after, NextRequest } from 'next/server'
import { requireAuth, requireClient } from '@/server/auth'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { clientRepo } from '@/server/repositories/client.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { bookingService, ServiceError } from '@/server/services/booking.service'
import { sanitizeBookingsForRole } from '@/server/services/booking-visibility.service'
import { ok, err } from '@/server/response'
import { createBookingSchema, myBookingsQuerySchema } from '@/server/schemas/booking.schema'

export const maxDuration = 60

// GET /api/v1/bookings/my — list user's bookings (client or cleaner)
export const GET = requireAuth(async (req: NextRequest, _ctx, user) => {
  const clientRequestId = req.headers.get('x-client-request-id') ?? null
  const browser = detectBrowserFamily(req.headers.get('user-agent'))
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = myBookingsQuerySchema.safeParse(params)
  if (!parsed.success) return err(parsed.error.message, 422)

  const { page, page_size, status } = parsed.data
  const shouldScheduleReconcile = shouldScheduleListReconcile(page, status)

  if (user.role === 'client') {
    let client = await clientRepo.findByUserId(user.id)
    if (!client) {
      client = await clientRepo.create(user.id)
      console.info('bookings.list.client.profile_created', {
        clientRequestId,
        userId: user.id,
        role: user.role,
        clientId: client.id,
      })
    }
    const listStartedAt = Date.now()
    const [bookings, total] = await bookingRepo.findByClient(client.id, { page, pageSize: page_size, status })
    const bookingIds = bookings.map((b) => b.id)
    if (total === 0) {
      console.info('bookings.list.client.empty', {
        clientRequestId,
        userId: user.id,
        role: user.role,
        browser,
        page,
        page_size,
        status: status ?? 'all',
      })
    }
    console.info('bookings.list.result', {
      clientRequestId,
      userId: user.id,
      role: user.role,
      browser,
      page,
      page_size,
      status: status ?? 'all',
      total,
      count: bookings.length,
      duration_ms: Date.now() - listStartedAt,
    })
    scheduleNonBlockingReconcile({
      enabled: shouldScheduleReconcile,
      bookingIds,
      clientRequestId,
      userId: user.id,
      role: user.role,
    })
    return ok({ bookings, total, page, page_size })
  }

  if (user.role === 'cleaner') {
    let cleaner = await cleanerRepo.findByUserId(user.id)
    if (!cleaner) {
      cleaner = await cleanerRepo.create(user.id)
      console.info('bookings.list.cleaner.profile_created', {
        clientRequestId,
        userId: user.id,
        role: user.role,
        cleanerId: cleaner.id,
      })
    }
    const listStartedAt = Date.now()
    const [bookings, total] = await bookingRepo.findByCleaner(cleaner.id, { page, pageSize: page_size, status })
    const bookingIds = bookings.map((b) => b.id)
    if (total === 0) {
      console.info('bookings.list.cleaner.empty', {
        clientRequestId,
        userId: user.id,
        role: user.role,
        browser,
        page,
        page_size,
        status: status ?? 'all',
      })
    }
    console.info('bookings.list.result', {
      clientRequestId,
      userId: user.id,
      role: user.role,
      browser,
      page,
      page_size,
      status: status ?? 'all',
      total,
      count: bookings.length,
      duration_ms: Date.now() - listStartedAt,
    })
    scheduleNonBlockingReconcile({
      enabled: shouldScheduleReconcile,
      bookingIds,
      clientRequestId,
      userId: user.id,
      role: user.role,
    })
    return ok({ bookings: sanitizeBookingsForRole(bookings as any[], 'cleaner'), total, page, page_size })
  }

  return err('Forbidden', 403)
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

function shouldScheduleListReconcile(page: number, status?: string) {
  if (page !== 1) return false
  if (!status) return true
  return ['pending', 'accepted', 'confirmed', 'in_progress', 'completed', 'disputed'].includes(status)
}

function scheduleNonBlockingReconcile(args: {
  enabled: boolean
  bookingIds: string[]
  clientRequestId: string | null
  userId: string
  role: string
}) {
  if (!args.enabled) return
  const uniqueIds = Array.from(new Set(args.bookingIds.filter(Boolean)))
  if (uniqueIds.length === 0) return

  const run = async () => {
    const startedAt = Date.now()
    try {
      await bookingService.reconcileDeadlinesForBookings(uniqueIds)
      console.info('bookings.list.reconcile.completed', {
        clientRequestId: args.clientRequestId,
        userId: args.userId,
        role: args.role,
        count: uniqueIds.length,
        duration_ms: Date.now() - startedAt,
      })
    } catch (error) {
      console.error('bookings.list.reconcile.failed', {
        clientRequestId: args.clientRequestId,
        userId: args.userId,
        role: args.role,
        count: uniqueIds.length,
        duration_ms: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  try {
    after(run)
  } catch {
    // Vitest route handler calls execute outside a Next request scope.
    void run()
  }
}

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
