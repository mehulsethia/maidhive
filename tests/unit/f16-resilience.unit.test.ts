import { describe, expect, it, vi } from 'vitest'

vi.mock('@/server/repositories/notification.repo', () => ({
  notificationRepo: {
    create: vi.fn(async () => {
      throw new Error('db unavailable')
    }),
  },
}))

describe('F16 resilience unit coverage', () => {
  it('UT-RES-01 in-app notification push swallows repo failures and does not throw', async () => {
    const { pushInAppNotification } = await import('@/server/services/in-app-notification.service')
    await expect(
      pushInAppNotification({
        userId: '11111111-1111-1111-1111-111111111111',
        type: 'booking_created_pending',
        title: 'Test',
        body: 'Test body',
        data: { booking_id: 'booking_1' },
      }),
    ).resolves.toBeUndefined()
  })

  it('UT-RES-02 cleaner booking sanitizer degrades safely with missing dates/fields', async () => {
    const { sanitizeBookingForRole } = await import('@/server/services/booking-visibility.service')

    const input: any = {
      id: 'booking_1',
      status: 'confirmed',
      city: 'Larnaca',
      client: { user: { name: '', phone: '+35799123456' } },
    }

    const output = sanitizeBookingForRole(input, 'cleaner')
    expect(output.client.user.name).toBe('Client')
    expect(output.cleanerPrivacy).toBeTruthy()
  })

  it('UT-RES-03 cleaner chat visibility helper is deterministic for malformed schedule values', async () => {
    const { isChatReadOnly, canViewChatHistoryForBooking } = await import('@/lib/chat-window')
    expect(canViewChatHistoryForBooking({ status: 'completed', scheduled_end: 'bad-date' as any })).toBe(true)
    expect(isChatReadOnly('bad-date' as any, Date.now(), 'completed')).toBe(false)
  })
})
