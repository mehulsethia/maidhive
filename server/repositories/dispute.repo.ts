import { db } from '../db'
import type { Prisma } from '@prisma/client'

export const disputeRepo = {
  findById: (id: string) =>
    db.dispute.findUnique({
      where: { id },
      include: { booking: true, raisedByUser: true },
    }),

  findByBookingId: (bookingId: string) =>
    db.dispute.findUnique({ where: { bookingId } }),

  create: (data: {
    bookingId: string
    raisedBy: string
    reason: string
    issueType?: string
    explanation?: string
    evidence?: string[]
  }) =>
    db.dispute.create({
      data: {
        bookingId: data.bookingId,
        raisedBy: data.raisedBy,
        reason: data.reason,
        issueType: data.issueType,
        explanation: data.explanation,
        evidence: data.evidence ? data.evidence : undefined,
      },
    }),

  update: (id: string, data: Prisma.DisputeUpdateInput) =>
    db.dispute.update({ where: { id }, data }),

  listOpen: (page: number, pageSize: number) =>
    Promise.all([
      db.dispute.findMany({
        where: { status: { not: 'closed' } },
        include: { booking: true, raisedByUser: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.dispute.count({ where: { status: { not: 'closed' } } }),
    ]),

  listByRaisedBy: (raisedBy: string, page: number, pageSize: number) =>
    Promise.all([
      db.dispute.findMany({
        where: { raisedBy },
        include: { booking: { include: { cleaner: { include: { user: true } } } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.dispute.count({ where: { raisedBy } }),
    ]),
}
