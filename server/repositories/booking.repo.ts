import { db } from '../db'
import type { Prisma } from '@prisma/client'

const bookingInclude = {
  client: { include: { user: true } },
  cleaner: { include: { user: true } },
  payment: true,
  review: true,
} satisfies Prisma.BookingInclude

export const bookingRepo = {
  findById: (id: string) =>
    db.booking.findUnique({ where: { id }, include: bookingInclude }),

  findByClient: (clientId: string, params: { page: number; pageSize: number; status?: string }) => {
    const where = { clientId, ...(params.status ? { status: params.status } : {}) }
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
      OR: [
        { status: { not: 'pending' } },
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
  }) =>
    db.booking.create({ data, include: bookingInclude }),

  update: (id: string, data: Prisma.BookingUpdateInput) =>
    db.booking.update({ where: { id }, data, include: bookingInclude }),

  listAll: (params: { status?: string; page: number; pageSize: number }) => {
    const statuses = params.status
      ? params.status
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
    const where: Prisma.BookingWhereInput =
      statuses.length > 0
        ? statuses.length === 1
          ? { status: statuses[0] as any }
          : { status: { in: statuses as any[] } }
        : {}
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
        status: { notIn: ['cancelled', 'expired'] },
        OR: [
          { scheduledStart: { lt: end }, scheduledEnd: { gt: start } },
        ],
      },
    }),
}
