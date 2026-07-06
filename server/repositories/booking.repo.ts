import { db } from '../db'
import type { Prisma } from '@prisma/client'

function completedReleasedBookingWhere(): Prisma.BookingWhereInput {
  const disputeWindowHours = Number(process.env.NEXT_PUBLIC_DISPUTE_WINDOW_HOURS ?? 24)
  const releaseWindowMs = (Number.isFinite(disputeWindowHours) && disputeWindowHours > 0 ? disputeWindowHours : 24) * 60 * 60 * 1000
  const releaseCutoff = new Date(Date.now() - releaseWindowMs)

  return {
    status: 'completed',
    OR: [
      { payment: { is: { status: 'transferred' } } },
      { scheduledEnd: { lte: releaseCutoff } },
    ],
  }
}

function bookingInclude() {
  return {
    client: {
      include: {
        user: true,
        _count: {
          select: {
            bookings: { where: completedReleasedBookingWhere() },
          },
        },
      },
    },
    cleaner: { include: { user: true } },
    payment: true,
    review: true,
    dispute: true,
    actionEvents: {
      orderBy: { createdAt: 'asc' },
    },
    _count: {
      select: {
        messages: true,
      },
    },
  } satisfies Prisma.BookingInclude
}

function bookingListInclude() {
  return {
    client: {
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            bookings: { where: completedReleasedBookingWhere() },
          },
        },
      },
    },
    cleaner: {
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },
    payment: true,
    dispute: {
      select: {
        id: true,
        status: true,
        reason: true,
        issueType: true,
        reporterRole: true,
        responseExplanation: true,
        responderRole: true,
        respondedAt: true,
        resolutionType: true,
        resolutionNote: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    },
    review: {
      select: {
        id: true,
        rating: true,
        createdAt: true,
      },
    },
    _count: {
      select: {
        messages: true,
      },
    },
  } satisfies Prisma.BookingInclude
}

export const bookingRepo = {
  findById: (id: string) =>
    db.booking.findUnique({ where: { id }, include: bookingInclude() }),

  findByClient: (clientId: string, params: { page: number; pageSize: number; status?: string }) => {
    const where: Prisma.BookingWhereInput = {
      clientId,
      ...(params.status ? { status: params.status } : {}),
    }
    return Promise.all([
      db.booking.findMany({
        where,
        include: bookingListInclude(),
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.booking.count({ where }),
    ])
  },

  findByCleaner: (cleanerId: string, params: { page: number; pageSize: number; status?: string }) => {
    const where: Prisma.BookingWhereInput = {
      cleanerId,
      ...(params.status ? { status: params.status } : {}),
      NOT: { status: 'draft' },
      OR: [
        { status: { notIn: ['pending', 'draft', 'cancelled'] } },
        {
          status: 'pending',
          payment: {
            is: {
              status: { in: ['authorized', 'captured', 'transferred'] },
            },
          },
        },
        {
          status: 'cancelled',
          OR: [
            { acceptedAt: { not: null } },
            { confirmedAt: { not: null } },
            { startedAt: { not: null } },
            {
              payment: {
                is: {
                  OR: [
                    { authorizedAt: { not: null } },
                    { capturedAt: { not: null } },
                    { transferredAt: { not: null } },
                  ],
                },
              },
            },
          ],
        },
      ],
    }
    return Promise.all([
      db.booking.findMany({
        where,
        include: bookingListInclude(),
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.booking.count({ where }),
    ])
  },

  create: (data: {
    clientId: string
    cleanerId: string
    serviceType: string
    specialInstructions?: string
    address: string
    city: string
    postcode: string
    country: string
    apartmentDetails?: string
    accessNotes: string
    scheduledStart: Date
    scheduledEnd: Date
    durationHours: number
    hourlyRate: number
    subtotal: number
    platformFeePct: number
    platformFee: number
    cleanerPayout: number
    totalAmount: number
    acceptBy: Date
    originalScheduledStart?: Date
    serviceLatitude?: number
    serviceLongitude?: number
    geocodingProvider?: string
    geocodedAt?: Date
    geocodingStatus?: string
    status?: string
  }) =>
    db.booking.create({ data, include: bookingInclude() }),

  update: (id: string, data: Prisma.BookingUpdateInput) =>
    db.booking.update({ where: { id }, data, include: bookingInclude() }),

  updateWithActionEvent: (
    id: string,
    update: Prisma.BookingUpdateInput,
    event: {
      type: string
      actorRole?: string
      metadata?: Prisma.InputJsonValue
    },
  ) =>
    db.$transaction(async (tx) => {
      await tx.bookingActionEvent.create({
        data: {
          bookingId: id,
          ...event,
        },
      })
      return tx.booking.update({
        where: { id },
        data: update,
        include: bookingInclude(),
      })
    }),

  findOverlappingDraftForClient: (params: {
    clientId: string
    cleanerId: string
    start: Date
    end: Date
  }) =>
    db.booking.findFirst({
      where: {
        clientId: params.clientId,
        cleanerId: params.cleanerId,
        status: 'draft',
        scheduledStart: { lt: params.end },
        scheduledEnd: { gt: params.start },
      },
      include: bookingInclude(),
      orderBy: { updatedAt: 'desc' },
    }),

  listAll: (params: { status?: string; page: number; pageSize: number }) => {
    const statuses = params.status
      ? params.status
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
    const includesFailedPayments = statuses.includes('failed_payments')
    const filteredStatuses = statuses.filter((s) => s !== 'failed_payments')
    const baseStatusWhere: Prisma.BookingWhereInput =
      filteredStatuses.length > 0
        ? filteredStatuses.length === 1
          ? { status: filteredStatuses[0] as any }
          : { status: { in: filteredStatuses as any[] } }
        : {}
    const where: Prisma.BookingWhereInput = includesFailedPayments
      ? {
          ...baseStatusWhere,
          payment: { is: { status: 'failed' } },
          NOT: {
            status: 'cancelled',
            cancelledBy: { not: null },
          },
        }
      : baseStatusWhere
    return Promise.all([
      db.booking.findMany({
        where,
        include: bookingInclude(),
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.booking.count({ where }),
    ])
  },

  findActiveForCleaner: (cleanerId: string, start: Date, end: Date, excludeBookingId?: string) =>
    {
      const now = new Date()
      return db.booking.findMany({
        where: {
          cleanerId,
          ...(excludeBookingId ? { NOT: { id: excludeBookingId } } : {}),
          AND: [
            {
              OR: [
                {
                  status: { in: ['accepted', 'confirmed', 'in_progress', 'completed', 'disputed'] },
                },
                {
                  status: 'pending',
                  acceptBy: { gt: now },
                  payment: {
                    is: {
                      status: { in: ['authorized', 'captured', 'transferred'] },
                    },
                  },
                },
              ],
            },
            {
              OR: [
                { scheduledStart: { lt: end }, scheduledEnd: { gt: start } },
                {
                  proposedStart: { not: null, lt: end },
                  proposedEnd: { not: null, gt: start },
                  OR: [
                    {
                      status: 'pending',
                      acceptBy: { gt: now },
                      payment: {
                        is: {
                          status: { in: ['authorized', 'captured', 'transferred'] },
                        },
                      },
                    },
                    {
                      status: { in: ['accepted', 'confirmed'] },
                      proposalContext: { in: ['post_confirmation', 'amend_start'] },
                      proposalExpiresAt: { gt: now },
                    },
                  ],
                },
              ],
            },
          ],
        },
      })
    },
}
