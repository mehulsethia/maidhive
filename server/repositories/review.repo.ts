import { db } from '../db'
import type { Prisma } from '@prisma/client'

export const reviewRepo = {
  findByBookingId: (bookingId: string) =>
    db.review.findUnique({ where: { bookingId } }),

  findByCleanerId: (cleanerId: string, page: number, pageSize: number) =>
    Promise.all([
      db.review.findMany({
        where: { cleanerId, isPublic: true },
        include: { client: { include: { user: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.review.count({ where: { cleanerId, isPublic: true } }),
    ]),

  create: (data: {
    bookingId: string
    cleanerId: string
    clientId: string
    rating: number
    comment?: string
    isPublic?: boolean
  }) =>
    db.review.create({ data }),

  update: (id: string, data: Prisma.ReviewUpdateInput) =>
    db.review.update({ where: { id }, data }),
}
