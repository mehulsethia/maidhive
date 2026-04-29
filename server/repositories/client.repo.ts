import { db } from '../db'

export const clientRepo = {
  findById: (id: string) =>
    db.client.findUnique({ where: { id }, include: { user: true } }),

  findByUserId: (userId: string) =>
    db.client.findUnique({ where: { userId }, include: { user: true } }),

  create: (userId: string) =>
    db.client.create({ data: { userId }, include: { user: true } }),

  update: (id: string, data: Partial<{
    stripeCustomerId: string
    defaultAddress: string | null
    defaultCity: string | null
    defaultPostcode: string | null
    defaultCountry: string
    idFileName: string | null
    idFileUrl: string | null
    idSubmittedAt: Date | null
  }>) =>
    db.client.update({ where: { id }, data }),
}
