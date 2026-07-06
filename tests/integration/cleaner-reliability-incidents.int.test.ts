import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  incidents: [] as any[],
  strikes: [] as any[],
  snapshotUpdates: [] as any[],
  cancellationEvents: [] as any[],
}))

vi.mock('@/server/db', () => {
  const cleanerReliabilityIncident = {
    findUnique: vi.fn(async ({ where }: any) => {
      const key = where.cleanerId_incidentType_sourceKey
      return state.incidents.find(
        (incident) =>
          incident.cleanerId === key.cleanerId &&
          incident.incidentType === key.incidentType &&
          incident.sourceKey === key.sourceKey,
      ) ?? null
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const incident = state.incidents.find((entry) => entry.id === where.id)
      if (data.bookingIds?.push) incident.bookingIds.push(data.bookingIds.push)
      if (data.latestAt) incident.latestAt = data.latestAt
      return incident
    }),
    create: vi.fn(async ({ data }: any) => {
      const incident = { id: `incident_${state.incidents.length + 1}`, ...data }
      state.incidents.push(incident)
      return incident
    }),
    findFirst: vi.fn(async ({ where }: any) =>
      state.incidents.find(
        (incident) =>
          incident.cleanerId === where.cleanerId &&
          incident.incidentType === where.incidentType &&
          incident.id !== where.id.not &&
          incident.occurredAt >= where.occurredAt.gte,
      ) ?? null,
    ),
  }
  const db: any = {
    cleanerReliabilitySnapshot: {
      findUnique: vi.fn(async () => ({
        isSuperCleaner: true,
        recoveryCancellationStartedAt: null,
      })),
      updateMany: vi.fn(async ({ data }: any) => {
        state.snapshotUpdates.push(data)
        return { count: 1 }
      }),
    },
    cleanerReliabilityIncident,
    cleanerStrike: {
      create: vi.fn(async ({ data }: any) => {
        const strike = { id: `strike_${state.strikes.length + 1}`, ...data }
        state.strikes.push(strike)
        return strike
      }),
    },
    cleanerCancellationEvent: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = state.cancellationEvents.find(
          (event) => event.bookingId === where.bookingId,
        )
        if (existing) {
          Object.assign(existing, update)
          return existing
        }
        const event = {
          id: `event_${state.cancellationEvents.length + 1}`,
          incidentId: null,
          ...create,
        }
        state.cancellationEvents.push(event)
        return event
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const event = state.cancellationEvents.find((entry) => entry.id === where.id)
        Object.assign(event, data)
        return event
      }),
    },
  }
  db.$transaction = vi.fn(async (callback: any) => callback(db))
  return { db }
})

describe('cleaner reliability incident integration', () => {
  beforeEach(() => {
    state.incidents.length = 0
    state.strikes.length = 0
    state.snapshotUpdates.length = 0
    state.cancellationEvents.length = 0
    vi.clearAllMocks()
  })

  it('groups same-day bookings, preserves the first-incident allowance, then strikes every further incident in-window', async () => {
    const { cleanerReliabilityService } = await import(
      '@/server/services/cleaner-reliability.service'
    )
    vi.spyOn(cleanerReliabilityService, 'recalculate').mockResolvedValue(null)

    await cleanerReliabilityService.recordLastMinuteCancellation({
      cleanerId: 'cleaner_1',
      bookingId: 'booking_1',
      occurredAt: new Date('2026-07-06T06:00:00.000Z'),
      issuedBy: 'user_1',
    })
    await cleanerReliabilityService.recordLastMinuteCancellation({
      cleanerId: 'cleaner_1',
      bookingId: 'booking_2',
      occurredAt: new Date('2026-07-06T09:00:00.000Z'),
      issuedBy: 'user_1',
    })

    expect(state.incidents).toHaveLength(1)
    expect(state.incidents[0].bookingIds).toEqual(['booking_1', 'booking_2'])
    expect(state.strikes).toHaveLength(0)
    expect(state.snapshotUpdates).toHaveLength(0)

    await cleanerReliabilityService.recordLastMinuteCancellation({
      cleanerId: 'cleaner_1',
      bookingId: 'booking_3',
      occurredAt: new Date('2026-07-07T06:00:00.000Z'),
      issuedBy: 'user_1',
    })
    await cleanerReliabilityService.recordLastMinuteCancellation({
      cleanerId: 'cleaner_1',
      bookingId: 'booking_4',
      occurredAt: new Date('2026-07-08T06:00:00.000Z'),
      issuedBy: 'user_1',
    })

    expect(state.incidents).toHaveLength(3)
    expect(state.strikes).toHaveLength(2)
    expect(state.snapshotUpdates).toHaveLength(2)
    expect(state.snapshotUpdates.at(-1).recoveryCancellationStartedAt).toEqual(
      new Date('2026-07-08T06:00:00.000Z'),
    )
  })

  it('persists every cleaner cancellation window while only last-minute accepted events create incidents', async () => {
    const { cleanerReliabilityService } = await import(
      '@/server/services/cleaner-reliability.service'
    )
    vi.spyOn(cleanerReliabilityService, 'recalculate').mockResolvedValue(null)
    const scheduledStart = new Date('2026-07-10T12:00:00.000Z')

    await cleanerReliabilityService.recordCleanerCancellation({
      cleanerId: 'cleaner_1',
      bookingId: 'booking_25h',
      scheduledStart,
      cancelledAt: new Date('2026-07-09T11:00:00.000Z'),
      issuedBy: 'user_1',
      acceptedBooking: true,
    })
    await cleanerReliabilityService.recordCleanerCancellation({
      cleanerId: 'cleaner_1',
      bookingId: 'booking_18h',
      scheduledStart,
      cancelledAt: new Date('2026-07-09T18:00:00.000Z'),
      issuedBy: 'user_1',
      acceptedBooking: true,
    })
    await cleanerReliabilityService.recordCleanerCancellation({
      cleanerId: 'cleaner_1',
      bookingId: 'booking_6h',
      scheduledStart,
      cancelledAt: new Date('2026-07-10T06:00:00.000Z'),
      issuedBy: 'user_1',
      acceptedBooking: true,
    })

    expect(
      state.cancellationEvents.map((event) => event.cancellationWindow),
    ).toEqual(['more_than_24h', 'between_12h_24h', 'less_than_12h'])
    expect(state.cancellationEvents.map((event) => event.acceptedBooking)).toEqual([
      true,
      true,
      true,
    ])
    expect(state.incidents).toHaveLength(1)
    expect(state.strikes).toHaveLength(0)
    expect(state.cancellationEvents.at(-1).incidentId).toBe('incident_1')
  })
})
