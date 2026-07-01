import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  findManyArgs: null as any,
  countArgs: null as any,
}))

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findMany: vi.fn(async (args: any) => {
        state.findManyArgs = args
        return []
      }),
      count: vi.fn(async (args: any) => {
        state.countArgs = args
        return 0
      }),
    },
  },
}))

import { bookingRepo } from '@/server/repositories/booking.repo'

describe('admin failed-payment filter', () => {
  beforeEach(() => {
    state.findManyArgs = null
    state.countArgs = null
  })

  it('keeps user-driven cancellations out of genuine payment failures', async () => {
    await bookingRepo.listAll({
      status: 'failed_payments',
      page: 1,
      pageSize: 20,
    })

    expect(state.findManyArgs.where).toEqual({
      payment: { is: { status: 'failed' } },
      NOT: {
        status: 'cancelled',
        cancelledBy: { not: null },
      },
    })
    expect(state.countArgs.where).toEqual(state.findManyArgs.where)
  })
})
