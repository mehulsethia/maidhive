import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  autoStartDue: [] as Array<{ id: string; scheduledStart: Date }>,
  autoCompleteDue: [] as Array<{ id: string; status: string; scheduledEnd: Date; dispute: { status: string } | null }>,
  startCalls: [] as string[],
  completeCalls: [] as string[],
}))

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findMany: vi.fn(async (query: any) => {
        if (query?.where?.status?.in?.includes('accepted')) {
          return state.autoStartDue
        }
        return state.autoCompleteDue
      }),
    },
    payment: {
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}))

vi.mock('@/server/stripe', () => ({
  stripe: {
    paymentIntents: {
      capture: vi.fn(async () => ({ latest_charge: 'ch_1' })),
      cancel: vi.fn(async () => ({ id: 'pi_cancelled' })),
    },
  },
}))

vi.mock('@/server/services/loops-email.service', () => ({
  loopsEmailService: {
    sendCleanerPayoutNotification: vi.fn(async () => true),
    sendClientPaymentReceipt: vi.fn(async () => true),
  },
}))

vi.mock('@/server/services/in-app-notification.service', () => ({
  pushInAppNotification: vi.fn(async () => true),
}))

vi.mock('@/server/services/booking.service', () => ({
  bookingService: {
    startBySystem: vi.fn(async (id: string) => {
      state.startCalls.push(id)
      return { id, status: 'in_progress' }
    }),
    completeBySystem: vi.fn(async (id: string) => {
      state.completeCalls.push(id)
      return { id, status: 'completed' }
    }),
  },
}))

describe('F08 lifecycle unit coverage', () => {
  beforeEach(() => {
    vi.resetModules()
    state.autoStartDue = []
    state.autoCompleteDue = []
    state.startCalls = []
    state.completeCalls = []
  })

  it('UT-LIFECYCLE-01 auto-start eligibility starts due confirmed/accepted bookings', async () => {
    state.autoStartDue = [
      { id: 'b1', scheduledStart: new Date('2026-06-10T09:00:00.000Z') },
      { id: 'b2', scheduledStart: new Date('2026-06-10T10:00:00.000Z') },
    ]

    const { paymentLifecycleService } = await import('@/server/services/payment-lifecycle.service')
    const summary = await paymentLifecycleService.processAutoStarts()

    expect(summary.checked).toBe(2)
    expect(summary.started).toBe(2)
    expect(state.startCalls).toEqual(['b1', 'b2'])
  })

  it('UT-LIFECYCLE-02 auto-complete keeps booking lifecycle independent from unresolved disputes', async () => {
    state.autoCompleteDue = [
      {
        id: 'b1',
        status: 'in_progress',
        scheduledEnd: new Date('2026-06-10T11:00:00.000Z'),
        dispute: null,
      },
      {
        id: 'b2',
        status: 'confirmed',
        scheduledEnd: new Date('2026-06-10T12:00:00.000Z'),
        dispute: { status: 'open' },
      },
    ]

    const { paymentLifecycleService } = await import('@/server/services/payment-lifecycle.service')
    const summary = await paymentLifecycleService.processAutoCompletions()

    expect(summary.checked).toBe(2)
    expect(summary.completed).toBe(2)
    expect(state.completeCalls).toEqual(['b1', 'b2'])
  })

  it('UT-LIFECYCLE-03 auto-complete processes disputed booking when dispute is resolved', async () => {
    state.autoCompleteDue = [
      {
        id: 'b3',
        status: 'disputed',
        scheduledEnd: new Date('2026-06-10T13:00:00.000Z'),
        dispute: { status: 'resolved' },
      },
    ]

    const { paymentLifecycleService } = await import('@/server/services/payment-lifecycle.service')
    const summary = await paymentLifecycleService.processAutoCompletions()

    expect(summary.checked).toBe(1)
    expect(summary.completed).toBe(1)
    expect(summary.failed).toBe(0)
    expect(state.completeCalls).toEqual(['b3'])
  })
})
