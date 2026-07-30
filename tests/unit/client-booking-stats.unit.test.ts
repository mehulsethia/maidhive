import { describe, expect, it, vi } from 'vitest'

const countMock = vi.hoisted(() => vi.fn())
const findUniqueMock = vi.hoisted(() => vi.fn())

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      count: countMock,
      findUnique: findUniqueMock,
    },
  },
}))

describe('client booking stats', () => {
  it('counts full client totals with active, completed, and closed definitions', async () => {
    countMock
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)

    const { bookingRepo } = await import('@/server/repositories/booking.repo')
    const stats = await bookingRepo.countClientStats('client_1')

    expect(stats).toEqual({ all: 10, active: 4, completed: 3, closed: 2 })
    expect(countMock).toHaveBeenNthCalledWith(1, { where: { clientId: 'client_1' } })
    expect(countMock).toHaveBeenNthCalledWith(2, {
      where: {
        clientId: 'client_1',
        OR: [
          {
            status: 'pending',
            payment: { is: { status: { in: ['authorized', 'captured', 'transferred'] } } },
          },
          { status: { in: ['accepted', 'confirmed', 'in_progress'] } },
        ],
      },
    })
    expect(countMock).toHaveBeenNthCalledWith(3, { where: { clientId: 'client_1', status: 'completed' } })
    expect(countMock).toHaveBeenNthCalledWith(4, {
      where: { clientId: 'client_1', status: { in: ['cancelled', 'declined', 'expired'] } },
    })
  })

  it('includes start verification evidence on full booking reads', async () => {
    findUniqueMock.mockResolvedValueOnce(null)

    const { bookingRepo } = await import('@/server/repositories/booking.repo')
    await bookingRepo.findById('booking_1')

    expect(findUniqueMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'booking_1' },
      include: expect.objectContaining({
        startVerification: true,
      }),
    }))
  })
})
