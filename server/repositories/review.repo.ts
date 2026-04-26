import { db } from '../db'

const reviewSelect = {
  id: true,
  bookingId: true,
  cleanerId: true,
  clientId: true,
  rating: true,
  comment: true,
  cleanerReply: true,
  cleanerReplyAt: true,
  isPublic: true,
  createdAt: true,
  updatedAt: true,
} as any

export const reviewRepo = {
  findByBookingId: (bookingId: string) =>
    db.review.findUnique({ where: { bookingId }, select: reviewSelect }),

  findByCleanerId: (cleanerId: string, page: number, pageSize: number) =>
    Promise.all([
      db.review.findMany({
        where: { cleanerId, isPublic: true },
        select: {
          ...reviewSelect,
          client: { include: { user: true } },
        },
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
    db.review.create({ data, select: reviewSelect }),

  update: (id: string, data: any) =>
    db.review.update({ where: { id }, data, select: reviewSelect }),

  findById: (id: string) =>
    db.review.findUnique({
      where: { id },
      select: {
        ...reviewSelect,
        cleaner: { select: { id: true, userId: true } },
      },
    }),
}
