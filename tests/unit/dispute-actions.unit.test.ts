import { describe, expect, it } from 'vitest'
import { getDisputeParticipantAction } from '@/lib/dispute-actions'

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
})
