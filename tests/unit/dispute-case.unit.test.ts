import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DisputeCaseRecord } from '@/components/dispute-case-record'
import {
  getCounterpartyResponseInstruction,
  getDisputeCaseStatusLabel,
  getDisputeResponseDeadlineLabel,
} from '@/lib/dispute-case'

describe('dispute case presentation helpers', () => {
  it('keeps booking lifecycle separate by exposing active and resolved case labels', () => {
    expect(getDisputeCaseStatusLabel({ status: 'under_review' })).toBe('Under Review')
    expect(getDisputeCaseStatusLabel({ status: 'resolved' })).toBe('Resolved')
    expect(getDisputeCaseStatusLabel(null)).toBeNull()
  })

  it('formats response-specific instructions from the dispute notification deadline', () => {
    const dispute = {
      status: 'under_review',
      created_at: '2026-08-01T10:16:00.000Z',
    }

    expect(getDisputeResponseDeadlineLabel(dispute)).toContain('Response required by:')
    expect(getCounterpartyResponseInstruction(dispute)).toContain(
      'Submit one response and any supporting evidence within 24 hours of the dispute notification.',
    )
    expect(getCounterpartyResponseInstruction(dispute)).not.toContain('after scheduled completion')
  })

  it('attributes original and counterparty evidence with submitter and response timestamp', () => {
    const html = renderToStaticMarkup(createElement(DisputeCaseRecord, {
      dispute: {
        status: 'under_review',
        reporter_role: 'client',
        responder_role: 'cleaner',
        reason: 'Cleaner no-show',
        explanation: 'The cleaner did not arrive.',
        evidence: ['https://example.test/client-1.jpg', 'https://example.test/client-2.jpg'],
        response_explanation: 'Traffic delayed me and I notified the client.',
        response_evidence: ['https://example.test/cleaner-1.jpg'],
        created_at: '2026-08-01T10:16:00.000Z',
        responded_at: '2026-08-01T12:00:00.000Z',
      },
    }))

    expect(html).toContain('Submitted by client')
    expect(html).toContain('Response submitted by cleaner')
    expect(html).toContain('Response submitted on:')
    expect(html).toContain('Client evidence 1')
    expect(html).toContain('Client evidence 2')
    expect(html).toContain('Cleaner evidence 1')
    expect(html).not.toContain('Evidence 1')
  })
})
