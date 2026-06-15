import { describe, expect, it } from 'vitest'
import {
  canViewChatHistoryForBooking,
  canShowActiveMessageCta,
  getChatReadOnlyMessage,
  isChatReadOnly,
  isChatActiveForBooking,
} from '@/lib/chat-window'
import { compareConversationsByOperationalPriority } from '@/lib/booking-priority'
import { sendMessageSchema } from '@/server/schemas/message.schema'

describe('F12 Messaging/chat gating unit coverage', () => {
  it('UT-CHAT-01 chat history visibility allows only eligible booking states', () => {
    expect(canViewChatHistoryForBooking({ status: 'confirmed' })).toBe(true)
    expect(canViewChatHistoryForBooking({ status: 'in_progress' })).toBe(true)
    expect(canViewChatHistoryForBooking({ status: 'draft' })).toBe(false)
    expect(canViewChatHistoryForBooking({ status: 'pending' })).toBe(false)
    expect(canViewChatHistoryForBooking({ status: 'cancelled', _count: { messages: 0 } })).toBe(false)
    expect(canViewChatHistoryForBooking({ status: 'cancelled', _count: { messages: 2 } })).toBe(true)
    expect(canShowActiveMessageCta({ status: 'cancelled', _count: { messages: 2 } })).toBe(false)
    expect(canShowActiveMessageCta({ status: 'completed', scheduled_end: new Date(Date.now() - 60 * 60 * 1000) })).toBe(false)
  })

  it('UT-CHAT-02 read-only rules lock cancelled immediately and after scheduled end window', () => {
    const now = Date.now()
    const endedOneHourAgo = new Date(now - 60 * 60 * 1000)

    expect(isChatReadOnly(undefined, now, 'cancelled')).toBe(true)
    expect(isChatReadOnly(endedOneHourAgo, now, 'completed')).toBe(true)
    expect(isChatReadOnly(new Date(now + 60 * 60 * 1000), now, 'confirmed')).toBe(false)
  })

  it('UT-CHAT-03 read-only message text branches by cancellation vs normal expiry', () => {
    expect(getChatReadOnlyMessage('cancelled')).toContain('locked immediately after cancellation')
    expect(getChatReadOnlyMessage('completed')).toContain('30 minutes after scheduled booking completion')
  })

  it('UT-CHAT-04 send message payload enforces required non-empty content bounds', () => {
    const valid = sendMessageSchema.safeParse({ content: 'Cleaner is on the way.' })
    const empty = sendMessageSchema.safeParse({ content: '' })
    const tooLong = sendMessageSchema.safeParse({ content: 'x'.repeat(2001) })

    expect(valid.success).toBe(true)
    expect(empty.success).toBe(false)
    expect(tooLong.success).toBe(false)
    expect(isChatActiveForBooking({ status: 'completed', scheduled_end: new Date(Date.now() - 10 * 60 * 1000) })).toBe(true)
    expect(isChatActiveForBooking({ status: 'disputed', scheduled_end: new Date(Date.now() - 60 * 60 * 1000) })).toBe(false)
  })

  it('UT-CHAT-05 conversation ordering keeps operational chats above history and sorts active by nearest start', () => {
    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    const rows: any[] = [
      { id: 'completed_recent', status: 'completed', scheduled_start: new Date(now - oneHour).toISOString(), created_at: new Date(now).toISOString() },
      { id: 'confirmed_soon', status: 'confirmed', scheduled_start: new Date(now + oneHour).toISOString(), created_at: new Date(now).toISOString() },
      { id: 'in_progress', status: 'in_progress', scheduled_start: new Date(now - 2 * oneHour).toISOString(), created_at: new Date(now).toISOString() },
      { id: 'confirmed_later', status: 'confirmed', scheduled_start: new Date(now + 5 * oneHour).toISOString(), created_at: new Date(now).toISOString() },
      { id: 'cancelled', status: 'cancelled', scheduled_start: new Date(now - 3 * oneHour).toISOString(), created_at: new Date(now).toISOString() },
    ]

    const sorted = [...rows].sort(compareConversationsByOperationalPriority)
    expect(sorted.map((item) => item.id)).toEqual([
      'confirmed_soon',
      'confirmed_later',
      'in_progress',
      'completed_recent',
      'cancelled',
    ])
  })
})
