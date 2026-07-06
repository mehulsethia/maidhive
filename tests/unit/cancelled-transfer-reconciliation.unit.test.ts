import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  candidates: [] as any[],
  intents: new Map<string, any>(),
  updates: [] as any[],
}))

vi.mock('@/server/db', () => ({
  db: {
    payment: {
      findMany: vi.fn(async () => state.candidates),
      updateMany: vi.fn(async (args: any) => {
        state.updates.push(args)
        return { count: 1 }
      }),
    },
  },
}))

vi.mock('@/server/stripe', () => ({
  stripe: {
    paymentIntents: {
      retrieve: vi.fn(async (id: string) => state.intents.get(id)),
    },
    charges: {
      retrieve: vi.fn(async () => {
        throw new Error('Unexpected unexpanded charge lookup')
      }),
    },
    transfers: {
      retrieve: vi.fn(async () => {
        throw new Error('Unexpected unexpanded transfer lookup')
      }),
    },
  },
}))

vi.mock('@/server/services/loops-email.service', () => ({
  loopsEmailService: {},
}))

vi.mock('@/server/services/booking.service', () => ({
  bookingService: {},
}))

vi.mock('@/server/services/in-app-notification.service', () => ({
  pushInAppNotification: vi.fn(async () => true),
}))

function candidate() {
  return {
    id: 'payment_1',
    stripePaymentIntentId: 'pi_1',
    currency: 'eur',
    payoutScheduledAt: null,
    booking: {
      cleaner: {
        stripeAccountId: 'acct_cleaner',
      },
    },
  }
}

function paymentIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pi_1',
    status: 'succeeded',
    latest_charge: {
      id: 'ch_1',
      status: 'succeeded',
      captured: true,
      transfer: {
        id: 'tr_1',
        amount: 1600,
        amount_reversed: 0,
        currency: 'eur',
        destination: 'acct_cleaner',
        created: 1_750_000_000,
      },
    },
    ...overrides,
  }
}

describe('cancelled Stripe transfer reconciliation', () => {
  beforeEach(() => {
    vi.resetModules()
    state.candidates = [candidate()]
    state.intents = new Map([['pi_1', paymentIntent()]])
    state.updates = []
  })

  it('backfills local transfer state only from a matching Stripe transfer', async () => {
    const { paymentLifecycleService } = await import('@/server/services/payment-lifecycle.service')
    const summary = await paymentLifecycleService.reconcileCancelledPaymentTransfers()

    expect(summary.reconciled).toBe(1)
    expect(summary.failed).toBe(0)
    expect(state.updates).toHaveLength(1)
    expect(state.updates[0].data).toMatchObject({
      status: 'transferred',
      stripeChargeId: 'ch_1',
      stripeTransferId: 'tr_1',
      cleanerPayout: 16,
    })
    expect(state.updates[0].data.transferredAt).toEqual(new Date(1_750_000_000 * 1000))
  })

  it('does not mark a cancelled payment transferred when Stripe has no transfer', async () => {
    state.intents.set('pi_1', paymentIntent({
      latest_charge: {
        id: 'ch_1',
        status: 'succeeded',
        captured: true,
        transfer: null,
      },
    }))

    const { paymentLifecycleService } = await import('@/server/services/payment-lifecycle.service')
    const summary = await paymentLifecycleService.reconcileCancelledPaymentTransfers()

    expect(summary.missing_transfer).toBe(1)
    expect(summary.reconciled).toBe(0)
    expect(state.updates).toHaveLength(0)
  })

  it('rejects a transfer sent to a different connected account', async () => {
    state.intents.set('pi_1', paymentIntent({
      latest_charge: {
        id: 'ch_1',
        status: 'succeeded',
        captured: true,
        transfer: {
          id: 'tr_wrong',
          amount: 1600,
          amount_reversed: 0,
          currency: 'eur',
          destination: 'acct_other',
          created: 1_750_000_000,
        },
      },
    }))

    const { paymentLifecycleService } = await import('@/server/services/payment-lifecycle.service')
    const summary = await paymentLifecycleService.reconcileCancelledPaymentTransfers()

    expect(summary.invalid_transfer).toBe(1)
    expect(summary.reconciled).toBe(0)
    expect(state.updates).toHaveLength(0)
  })
})
