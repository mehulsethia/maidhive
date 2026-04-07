import { db } from '../db'

export const messageRepo = {
  findByBookingId: (bookingId: string) =>
    db.message.findMany({
      where: { bookingId },
      include: { sender: true },
      orderBy: { createdAt: 'asc' },
    }),

  send: (bookingId: string, senderId: string, content: string) =>
    db.message.create({
      data: { bookingId, senderId, content },
      include: { sender: true },
    }),
}
