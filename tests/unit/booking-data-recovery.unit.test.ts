import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  notifications: [] as any[],
  bookingById: new Map<string, any>(),
}))

vi.mock('@/lib/api', () => ({
  notificationsApi: {
    list: vi.fn(async () => ({
      success: true,
      data: { notifications: state.notifications, total: state.notifications.length, page: 1, page_size: 250 },
    })),
  },
  bookingsApi: {
    getById: vi.fn(async (id: string) => {
      const booking = state.bookingById.get(id)
      if (!booking) throw new Error('Not found')
      return { success: true, data: booking }
    }),
  },
}))

describe('booking data recovery', () => {
  beforeEach(() => {
    state.notifications = []
    state.bookingById.clear()
  })

  it('recovers deduped booking rows from notification booking ids', async () => {
    state.notifications = [
      { id: 'n1', data: { booking_id: '11111111-1111-4111-8111-111111111111' } },
      { id: 'n2', data: { booking_id: '11111111-1111-4111-8111-111111111111' } },
      { id: 'n3', data: { booking_id: '22222222-2222-4222-8222-222222222222' } },
    ]
    state.bookingById.set('11111111-1111-4111-8111-111111111111', {
      id: '11111111-1111-4111-8111-111111111111',
      status: 'completed',
      scheduled_start: '2026-05-14T10:00:00.000Z',
      created_at: '2026-05-01T10:00:00.000Z',
    })
    state.bookingById.set('22222222-2222-4222-8222-222222222222', {
      id: '22222222-2222-4222-8222-222222222222',
      status: 'confirmed',
      scheduled_start: '2026-06-02T09:00:00.000Z',
      created_at: '2026-05-02T10:00:00.000Z',
    })

    const { recoverBookingsFromNotifications } = await import('@/lib/booking-data-recovery')
    const rows = await recoverBookingsFromNotifications()

    expect(rows).toHaveLength(2)
    expect(rows[0].id).toBe('22222222-2222-4222-8222-222222222222')
    expect(rows[1].id).toBe('11111111-1111-4111-8111-111111111111')
  })

  it('ignores invalid or inaccessible booking ids safely', async () => {
    state.notifications = [
      { id: 'n1', data: { booking_id: 'invalid' } },
      { id: 'n2', data: { booking_id: '33333333-3333-4333-8333-333333333333' } },
    ]

    const { recoverBookingsFromNotifications } = await import('@/lib/booking-data-recovery')
    const rows = await recoverBookingsFromNotifications()
    expect(rows).toEqual([])
  })
})

