import { db } from '../db'
import { Prisma } from '@prisma/client'

const include = {
  booking: {
    include: {
      payment: true,
    },
  },
} satisfies Prisma.BookingFlowDraftInclude

export const bookingFlowDraftRepo = {
  findByClientAndCleaner: (clientId: string, cleanerId: string) =>
    db.bookingFlowDraft.findUnique({
      where: { clientId_cleanerId: { clientId, cleanerId } },
      include,
    }),

  upsertByClientAndCleaner: (args: {
    clientId: string
    cleanerId: string
    bookingId?: string | null
    lastStep: number
    durationHours?: number | null
    selectedDate?: string | null
    selectedSlot?: Date | null
    payload?: Prisma.InputJsonValue | null
  }) =>
    db.bookingFlowDraft.upsert({
      where: { clientId_cleanerId: { clientId: args.clientId, cleanerId: args.cleanerId } },
      create: {
        clientId: args.clientId,
        cleanerId: args.cleanerId,
        bookingId: args.bookingId ?? null,
        lastStep: args.lastStep,
        durationHours: args.durationHours ?? null,
        selectedDate: args.selectedDate ?? null,
        selectedSlot: args.selectedSlot ?? null,
        payload: args.payload ?? Prisma.JsonNull,
      },
      update: {
        bookingId: args.bookingId ?? null,
        lastStep: args.lastStep,
        durationHours: args.durationHours ?? null,
        selectedDate: args.selectedDate ?? null,
        selectedSlot: args.selectedSlot ?? null,
        payload: args.payload ?? Prisma.JsonNull,
      },
      include,
    }),

  clearByClientAndCleaner: (clientId: string, cleanerId: string) =>
    db.bookingFlowDraft.deleteMany({
      where: { clientId, cleanerId },
    }),

  clearByBookingId: (bookingId: string) =>
    db.bookingFlowDraft.deleteMany({ where: { bookingId } }),
}
