import { describe, expect, it, vi } from 'vitest'
import { getDisputeParticipantAction, isDisputeResponseWindowOpen } from '@/lib/dispute-actions'

describe('dispute participant actions', () => {
  it('shows report details to the original reporting party', () => {
    const action = getDisputeParticipantAction('client', {
      status: 'under_review',
      reporter_role: 'client',
    })

    expect(action).toEqual({ kind: 'view_report', label: 'View report details' })
  })

  it('prompts the counterparty to add one response before responding', () => {
    const action = getDisputeParticipantAction('cleaner', {
      status: 'under_review',
      reporter_role: 'client',
    })

    expect(action).toEqual({ kind: 'add_response', label: 'Add your response' })
  })

  it('shows the counterparty response after a response exists', () => {
    const action = getDisputeParticipantAction('cleaner', {
      status: 'under_review',
      reporter_role: 'client',
      responder_role: 'cleaner',
      responded_at: '2026-07-09T12:00:00.000Z',
    })

    expect(action).toEqual({ kind: 'view_response', label: 'View your response' })
  })

  it('closes counterparty responses 24 hours after the report notification window starts', () => {
    const createdAt = '2026-07-09T12:00:00.000Z'

    expect(isDisputeResponseWindowOpen({ status: 'under_review', created_at: createdAt }, new Date('2026-07-10T11:59:59.000Z').getTime())).toBe(true)
    expect(isDisputeResponseWindowOpen({ status: 'under_review', created_at: createdAt }, new Date('2026-07-10T12:00:01.000Z').getTime())).toBe(false)

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T12:00:01.000Z'))
    expect(getDisputeParticipantAction('cleaner', {
      status: 'under_review',
      reporter_role: 'client',
      created_at: createdAt,
    })).toEqual({ kind: 'none', label: '' })
    vi.useRealTimers()
  })
})
