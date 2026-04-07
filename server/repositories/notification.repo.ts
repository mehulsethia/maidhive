import { db } from '../db'

export const notificationRepo = {
  findByUserId: (userId: string, page: number, pageSize: number) =>
    Promise.all([
      db.notification.findMany({
        where: { userId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.notification.count({ where: { userId } }),
    ]),

  create: (data: { userId: string; type: string; title: string; body: string; data?: object }) =>
    db.notification.create({ data }),

  markRead: (id: string, userId: string) =>
    db.notification.updateMany({ where: { id, userId }, data: { isRead: true } }),

  markAllRead: (userId: string) =>
    db.notification.updateMany({ where: { userId }, data: { isRead: true } }),
}
