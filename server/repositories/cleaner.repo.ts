import { db } from '../db'

export const cleanerRepo = {
  findById: (id: string) =>
    db.cleaner.findUnique({
      where: { id },
      include: { user: true, serviceAreas: true, reliabilitySnapshot: true },
    }),

  findByUserId: (userId: string) =>
    db.cleaner.findUnique({
      where: { userId },
      include: { user: true, serviceAreas: true, reliabilitySnapshot: true },
    }),

  create: (userId: string) =>
    db.cleaner.create({
      data: { userId, hourlyRate: 15 },
      include: { user: true, serviceAreas: true, reliabilitySnapshot: true },
    }),

  update: (id: string, data: Partial<{
    bio: string | null
    profileImageUrl: string | null
    skills: string[]
    cleaningSupplies: string | null
    yearsExperience: number
    hourlyRate: number
    transportMode: string | null
    transportPickupLocation: string | null
    idType: string | null
    idFileName: string | null
    idFileUrl: string | null
    petAcceptance: boolean
    petComfortable: boolean | null
    workEligibilityAnswer: boolean | null
    workEligibilityConfirmed: boolean
    termsAccepted: boolean
    cleaningStandardsAccepted: boolean
    cleaningQuizScore: number | null
    cleaningQuizPassedAt: Date | null
    standardsCompleted: boolean
    quizPassed: boolean
    quizScore: number | null
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
      include: { user: true, serviceAreas: true, reliabilitySnapshot: true },
    }),

  search: (params: {
    city?: string
    availability?: 'any' | 'next_7_days'
    transportMode?: 'own_car' | 'bus_walk' | 'requires_pickup'
    cleaningSupplies?: 'own_supplies' | 'client_supplies'
    servicesOffered?: string[]
    minRating?: number
    minPrice?: number
    maxPrice?: number
    page: number
    pageSize: number
    prioritizeSuperCleaner?: boolean
  }) => {
    const where = {
      status: 'approved' as const,
      profileComplete: true,
      stripeOnboardingComplete: true,
      ...(params.transportMode ? { transportMode: params.transportMode } : {}),
      ...(params.cleaningSupplies ? { cleaningSupplies: params.cleaningSupplies } : {}),
      ...(params.availability === 'next_7_days'
        ? { availabilitySchedules: { some: { isActive: true } } }
        : {}),
      ...(params.servicesOffered && params.servicesOffered.length > 0
        ? { skills: { hasSome: params.servicesOffered } }
        : {}),
      ...(params.minRating !== undefined ? { averageRating: { gte: params.minRating } } : {}),
      ...(params.minPrice !== undefined ? { hourlyRate: { gte: params.minPrice } } : {}),
      ...(params.maxPrice !== undefined ? { hourlyRate: { lte: params.maxPrice } } : {}),
      ...(params.city
        ? { serviceAreas: { some: { city: { contains: params.city, mode: 'insensitive' as const } } } }
        : {}),
    }
    return Promise.all([
      db.cleaner.findMany({
        where,
        include: { user: true, serviceAreas: true, reliabilitySnapshot: true },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: params.prioritizeSuperCleaner
          ? [
              { reliabilitySnapshot: { isSuperCleaner: 'desc' } },
              { averageRating: 'desc' },
            ]
          : { averageRating: 'desc' },
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
    const where =
      !params.status
        ? {}
        : params.status === 'pending_approval'
          ? { status: 'pending' }
          : params.status === 'live'
            ? { status: 'approved', stripeOnboardingComplete: true, profileComplete: true }
            : params.status === 'approved'
              ? {
                  status: 'approved',
                  OR: [{ stripeOnboardingComplete: false }, { profileComplete: false }],
                }
              : { status: params.status }
    return Promise.all([
      db.cleaner.findMany({
        where,
        include: {
          user: true,
          reliabilitySnapshot: true,
          reliabilityIncidents: {
            orderBy: { occurredAt: 'desc' },
            take: 10,
          },
          cancellationEvents: {
            orderBy: { cancelledAt: 'desc' },
            take: 10,
          },
          strikes: {
            where: {
              strikeType: {
                in: ['reliability_last_minute_cancellation', 'reliability_no_show'],
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
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
