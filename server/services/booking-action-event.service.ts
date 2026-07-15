import { db } from '@/server/db'
import type { Prisma } from '@prisma/client'

export async function recordBookingActionEvent(args: {
  bookingId: string
  type: string
  actorRole?: string | null
  metadata?: Prisma.InputJsonValue
  createdAt?: Date
}) {
  return db.bookingActionEvent.create({
    data: {
      bookingId: args.bookingId,
      type: args.type,
      actorRole: args.actorRole ?? 'system',
      metadata: args.metadata,
      ...(args.createdAt ? { createdAt: args.createdAt } : {}),
    },
  })
}
