import { db } from '../db'

export const userRepo = {
  findById: (id: string) =>
    db.user.findUnique({ where: { id } }),

  findByEmail: (email: string) =>
    db.user.findUnique({ where: { email } }),

  upsert: (id: string, email: string, name: string, role: string) =>
    db.user.upsert({
      where: { id },
      update: {},
      create: { id, email, name, role },
    }),

  update: (id: string, data: { name?: string; phone?: string | null; avatarUrl?: string | null }) =>
    db.user.update({ where: { id }, data }),

  softDelete: (id: string) =>
    db.user.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } }),

  list: (params: { role?: string; search?: string; page: number; pageSize: number }) => {
    const where = {
      ...(params.role ? { role: params.role } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' as const } },
              { email: { contains: params.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      deletedAt: null,
    }
    return Promise.all([
      db.user.findMany({
        where,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.user.count({ where }),
    ])
  },

  toggleActive: (id: string, isActive: boolean) =>
    db.user.update({ where: { id }, data: { isActive } }),
}
