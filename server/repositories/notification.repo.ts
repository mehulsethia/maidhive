import { db } from '../db'
import type { Prisma } from '@prisma/client'

export const notificationRepo = {
  findByUserId: (
    userId: string,
    page: number,
    pageSize: number,
    options?: { includeArchived?: boolean; unreadOnly?: boolean },
  ) => {
    const includeArchived = options?.includeArchived ?? false
    const unreadOnly = options?.unreadOnly ?? false
    const where = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
      ...(includeArchived
        ? {}
        : {
            NOT: {
              data: {
                path: ['_archived'],
                equals: true,
              },
            },
          }),
    }
    return Promise.all([
      db.notification.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.notification.count({ where }),
    ])
  },

  create: (data: { userId: string; type: string; title: string; body: string; data?: object }) =>
    db.notification.create({ data }),

  markRead: (id: string, userId: string) =>
    db.notification.updateMany({ where: { id, userId }, data: { isRead: true } }),

  markAllRead: (userId: string) =>
    db.notification.updateMany({
      where: {
        userId,
        NOT: {
          data: {
            path: ['_archived'],
            equals: true,
          },
        },
      },
      data: { isRead: true },
    }),

  countUnread: (userId: string) =>
    db.notification.count({
      where: {
        userId,
        isRead: false,
        NOT: {
          data: {
            path: ['_archived'],
            equals: true,
          },
        },
      },
    }),

  async setArchived(id: string, userId: string, archived: boolean) {
    const notification = await db.notification.findFirst({
      where: { id, userId },
      select: { id: true, data: true },
    })
    if (!notification) return null

    const existingData =
      notification.data && typeof notification.data === 'object' && !Array.isArray(notification.data)
        ? (notification.data as Record<string, unknown>)
        : {}
    const nextData: Record<string, unknown> = {
      ...existingData,
      _archived: archived,
      _archived_at: archived ? new Date().toISOString() : null,
    }

    return db.notification.update({
      where: { id: notification.id },
      data: { data: nextData as Prisma.InputJsonValue },
    })
  },

  findByUserIds: (
    userIds: string[],
    page: number,
    pageSize: number,
    options?: { includeArchived?: boolean; unreadOnly?: boolean },
  ) => {
    const includeArchived = options?.includeArchived ?? false
    const unreadOnly = options?.unreadOnly ?? false
    const where = {
      userId: { in: userIds },
      ...(unreadOnly ? { isRead: false } : {}),
      ...(includeArchived
        ? {}
        : {
            NOT: {
              data: {
                path: ['_archived'],
                equals: true,
              },
            },
          }),
    }
    return Promise.all([
      db.notification.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.notification.count({ where }),
    ])
  },

  markAllReadForUsers: (userIds: string[]) =>
    db.notification.updateMany({
      where: {
        userId: { in: userIds },
        NOT: {
          data: {
            path: ['_archived'],
            equals: true,
          },
        },
      },
      data: { isRead: true },
    }),

  markReadForUsers: (id: string, userIds: string[]) =>
    db.notification.updateMany({
      where: { id, userId: { in: userIds } },
      data: { isRead: true },
    }),

  async setArchivedForUsers(id: string, userIds: string[], archived: boolean) {
    const notification = await db.notification.findFirst({
      where: { id, userId: { in: userIds } },
      select: { id: true, data: true },
    })
    if (!notification) return null

    const existingData =
      notification.data && typeof notification.data === 'object' && !Array.isArray(notification.data)
        ? (notification.data as Record<string, unknown>)
        : {}
    const nextData: Record<string, unknown> = {
      ...existingData,
      _archived: archived,
      _archived_at: archived ? new Date().toISOString() : null,
    }

    return db.notification.update({
      where: { id: notification.id },
      data: { data: nextData as Prisma.InputJsonValue },
    })
  },
}
