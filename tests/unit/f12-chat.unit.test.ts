import { describe, expect, it } from 'vitest'
import {
  canViewChatHistoryForBooking,
  getChatReadOnlyMessage,
  isChatReadOnly,
  isChatActiveForBooking,
} from '@/lib/chat-window'
import { sendMessageSchema } from '@/server/schemas/message.schema'

describe('F12 Messaging/chat gating unit coverage', () => {
  it('UT-CHAT-01 chat history visibility allows only eligible booking states', () => {
    expect(canViewChatHistoryForBooking({ status: 'confirmed' })).toBe(true)
    expect(canViewChatHistoryForBooking({ status: 'in_progress' })).toBe(true)
    expect(canViewChatHistoryForBooking({ status: 'draft' })).toBe(false)
    expect(canViewChatHistoryForBooking({ status: 'pending' })).toBe(false)
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
  })
})
