import { db } from '../db'
import type { Prisma } from '@prisma/client'

const disputeSelect = {
  id: true,
  bookingId: true,
  raisedBy: true,
  reason: true,
  issueType: true,
  explanation: true,
  evidence: true,
  status: true,
  resolutionType: true,
  resolutionNote: true,
  refundAmount: true,
  resolvedBy: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  reporterRole: true,
  bookingStatusAtReport: true,
} satisfies Prisma.DisputeSelect

export const disputeRepo = {
  findById: (id: string) =>
    db.dispute.findUnique({
      where: { id },
      select: {
        ...disputeSelect,
        booking: true,
        raisedByUser: true,
      },
    }),

  findByBookingId: (bookingId: string) =>
    db.dispute.findUnique({ where: { bookingId }, select: disputeSelect }),

  create: (data: {
    bookingId: string
    raisedBy: string
    reason: string
    issueType?: string
    explanation?: string
    evidence?: string[]
    reporterRole?: string
    bookingStatusAtReport?: string
  }) =>
    db.dispute.create({
      data: {
        bookingId: data.bookingId,
        raisedBy: data.raisedBy,
        reason: data.reason,
        issueType: data.issueType,
        explanation: data.explanation,
        evidence: data.evidence ? data.evidence : undefined,
        reporterRole: data.reporterRole,
        bookingStatusAtReport: data.bookingStatusAtReport,
      },
      select: disputeSelect,
    }),

  update: (id: string, data: Prisma.DisputeUpdateInput) =>
    db.dispute.update({ where: { id }, data, select: disputeSelect }),

  listOpen: (page: number, pageSize: number) =>
    Promise.all([
      db.dispute.findMany({
        where: { status: { not: 'closed' } },
        select: {
          ...disputeSelect,
          booking: true,
          raisedByUser: true,
        },
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
        select: {
          ...disputeSelect,
          booking: { include: { cleaner: { include: { user: true } } } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.dispute.count({ where: { raisedBy } }),
    ]),
}
