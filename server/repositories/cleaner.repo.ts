import { db } from '../db'

export const cleanerRepo = {
  findById: (id: string) =>
    db.cleaner.findUnique({
      where: { id },
      include: { user: true, serviceAreas: true },
    }),

  findByUserId: (userId: string) =>
    db.cleaner.findUnique({
      where: { userId },
      include: { user: true, serviceAreas: true },
    }),

  create: (userId: string) =>
    db.cleaner.create({
      data: { userId, hourlyRate: 15 },
      include: { user: true, serviceAreas: true },
    }),

  update: (id: string, data: Partial<{
    bio: string | null
    profileImageUrl: string | null
    skills: string[]
    yearsExperience: number
    hourlyRate: number
    transportMode: string | null
    transportPickupLocation: string | null
    idType: string | null
    idFileName: string | null
    petAcceptance: boolean
    workEligibilityConfirmed: boolean
    termsAccepted: boolean
    onboardingStep: number
    onboardingSkippedStep3: boolean
    onboardingSkippedStep4: boolean
    onboardingCompletedAt: Date | null
    profileComplete: boolean
    identityVerified: boolean
    stripeOnboardingComplete: boolean
    stripeAccountId: string
    status: string
    rejectionReason: string | null
    approvedAt: Date | null
    approvedBy: string | null
  }>) =>
    db.cleaner.update({
      where: { id },
      data,
      include: { user: true, serviceAreas: true },
    }),

  search: (params: { city?: string; page: number; pageSize: number }) => {
    const where = {
      status: 'approved' as const,
      profileComplete: true,
      ...(params.city
        ? { serviceAreas: { some: { city: { contains: params.city, mode: 'insensitive' as const } } } }
        : {}),
    }
    return Promise.all([
      db.cleaner.findMany({
        where,
        include: { user: true, serviceAreas: true },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { averageRating: 'desc' },
      }),
      db.cleaner.count({ where }),
    ])
  },

  listPending: () =>
    db.cleaner.findMany({
      where: { status: 'pending' },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    }),

  listAll: (params: { status?: string; page: number; pageSize: number }) => {
    const where = params.status ? { status: params.status } : {}
    return Promise.all([
      db.cleaner.findMany({
        where,
        include: { user: true },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.cleaner.count({ where }),
    ])
  },

  addServiceArea: (cleanerId: string, data: { city: string; postcodePrefix?: string; radiusKm?: number }) =>
    db.serviceArea.create({ data: { cleanerId, ...data } }),

  removeServiceArea: (id: string, cleanerId: string) =>
    db.serviceArea.deleteMany({ where: { id, cleanerId } }),

  countStrikes: (cleanerId: string) =>
    db.cleanerStrike.count({ where: { cleanerId } }),

  suspend: (id: string, suspended: boolean) =>
    db.cleaner.update({
      where: { id },
      data: { status: suspended ? 'suspended' : 'approved' },
    }),
}
