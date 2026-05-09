import { db } from '../db'
import type { Prisma } from '@prisma/client'

const bookingInclude = {
  client: {
    include: {
      user: true,
      _count: {
        select: {
          bookings: {
            where: { status: 'completed' },
          },
        },
      },
    },
  },
  cleaner: { include: { user: true } },
  payment: true,
  review: true,
} satisfies Prisma.BookingInclude

export const bookingRepo = {
  findById: (id: string) =>
    db.booking.findUnique({ where: { id }, include: bookingInclude }),

  findByClient: (clientId: string, params: { page: number; pageSize: number; status?: string }) => {
    const where: Prisma.BookingWhereInput = {
      clientId,
      ...(params.status ? { status: params.status } : {}),
    }
    return Promise.all([
      db.booking.findMany({
        where,
        include: bookingInclude,
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
      NOT: {
        AND: [
          { status: 'cancelled' },
          {
            OR: [
              { payment: null },
              { payment: { is: { status: { notIn: ['authorized', 'captured', 'transferred'] } } } },
            ],
          },
        ],
      },
      OR: [
        { status: { notIn: ['pending', 'draft'] } },
        {
          status: 'pending',
          payment: {
            is: {
              status: { in: ['authorized', 'captured', 'transferred'] },
            },
          },
        },
      ],
    }
    return Promise.all([
      db.booking.findMany({
        where,
        include: bookingInclude,
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
    status?: string
  }) =>
    db.booking.create({ data, include: bookingInclude }),

  update: (id: string, data: Prisma.BookingUpdateInput) =>
    db.booking.update({ where: { id }, data, include: bookingInclude }),

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
      include: bookingInclude,
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
        }
      : baseStatusWhere
    return Promise.all([
      db.booking.findMany({
        where,
        include: bookingInclude,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.booking.count({ where }),
    ])
  },

  findActiveForCleaner: (cleanerId: string, start: Date, end: Date) =>
    db.booking.findMany({
      where: {
        cleanerId,
        AND: [
          {
            OR: [
              {
                status: { in: ['accepted', 'confirmed', 'in_progress', 'completed', 'disputed'] },
              },
              {
                status: 'pending',
                payment: {
                  is: {
                    status: { in: ['authorized', 'captured', 'transferred'] },
                  },
                },
              },
            ],
          },
          { scheduledStart: { lt: end }, scheduledEnd: { gt: start } },
        ],
      },
    }),
}
