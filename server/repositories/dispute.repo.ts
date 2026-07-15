import { db } from '../db'
import { Prisma } from '@prisma/client'

const disputeSelect = {
  id: true,
  bookingId: true,
  raisedBy: true,
  reason: true,
  issueType: true,
  explanation: true,
  evidence: true,
  status: true,
  responseExplanation: true,
  responseEvidence: true,
  respondedBy: true,
  responderRole: true,
  respondedAt: true,
  resolutionType: true,
  noShowFinding: true,
  resolutionNote: true,
  refundAmount: true,
  resolvedBy: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  reporterRole: true,
  bookingStatusAtReport: true,
} satisfies Prisma.DisputeSelect

const participantDisputeSelect = {
  id: true,
  bookingId: true,
  raisedBy: true,
  reason: true,
  issueType: true,
  explanation: true,
  evidence: true,
  status: true,
  responseExplanation: true,
  responseEvidence: true,
  respondedBy: true,
  responderRole: true,
  respondedAt: true,
  resolutionType: true,
  refundAmount: true,
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

  attachParticipantResponse: (id: string, data: {
    explanation: string
    evidence?: string[]
    respondedBy: string
    responderRole: string
    respondedAt: Date
  }) => db.dispute.updateMany({
    where: {
      id,
      status: { in: ['open', 'under_review'] },
      respondedBy: null,
      responderRole: null,
      respondedAt: null,
    },
    data: {
      responseExplanation: data.explanation,
      responseEvidence: data.evidence ?? Prisma.JsonNull,
      respondedBy: data.respondedBy,
      responderRole: data.responderRole,
      respondedAt: data.respondedAt,
      status: 'under_review',
    },
  }),

  listForAdmin: (
    page: number,
    pageSize: number,
    queue: 'active' | 'resolved' | 'all' = 'all',
  ) => {
    const where: Prisma.DisputeWhereInput = queue === 'active'
      ? { status: { in: ['open', 'under_review'] } }
      : queue === 'resolved'
        ? { status: { in: ['resolved', 'closed'] } }
        : {}

    return Promise.all([
      db.dispute.findMany({
        where,
        select: {
          ...disputeSelect,
          booking: {
            include: {
              client: { include: { user: true } },
              cleaner: { include: { user: true } },
              payment: true,
            },
          },
          raisedByUser: true,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: queue === 'resolved'
          ? [{ resolvedAt: 'desc' }, { updatedAt: 'desc' }]
          : { createdAt: 'desc' },
      }),
      db.dispute.count({ where }),
    ])
  },

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

  listByParticipantUserId: (userId: string, page: number, pageSize: number) => {
    const where: Prisma.DisputeWhereInput = {
      OR: [
        { raisedBy: userId },
        { respondedBy: userId },
        { booking: { client: { userId } } },
        { booking: { cleaner: { userId } } },
      ],
    }

    return Promise.all([
      db.dispute.findMany({
        where,
        select: {
          ...participantDisputeSelect,
          booking: {
            include: {
              client: { include: { user: true } },
              cleaner: { include: { user: true } },
              payment: true,
            },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.dispute.count({ where }),
    ])
  },
}
