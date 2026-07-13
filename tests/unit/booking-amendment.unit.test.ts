import { describe, expect, it } from 'vitest'
import {
  AMENDMENT_EXPIRED_BODY,
  AMENDMENT_EXPIRED_TITLE,
  AMENDMENT_EXPIRY_OUTCOME_COPY,
  getEffectiveProposalExpiryMs,
  hasPendingAmendmentRequest,
  isWithinAmendStartWindow,
} from '@/lib/booking-amendment'

describe('booking amendment helpers', () => {
  it('filters amend start time slots to the same-day +/-3 hour window', () => {
    const originalStart = '2026-06-15T10:30:00.000Z' // 13:30 Cyprus

    expect(isWithinAmendStartWindow('2026-06-15T06:00:00.000Z', originalStart)).toBe(false) // 09:00 Cyprus
    expect(isWithinAmendStartWindow('2026-06-15T07:00:00.000Z', originalStart)).toBe(false) // 10:00 Cyprus
    expect(isWithinAmendStartWindow('2026-06-15T07:30:00.000Z', originalStart)).toBe(true) // 10:30 Cyprus
    expect(isWithinAmendStartWindow('2026-06-15T10:30:00.000Z', originalStart)).toBe(true) // 13:30 Cyprus
    expect(isWithinAmendStartWindow('2026-06-15T13:30:00.000Z', originalStart)).toBe(true) // 16:30 Cyprus
    expect(isWithinAmendStartWindow('2026-06-15T14:00:00.000Z', originalStart)).toBe(false) // 17:00 Cyprus
  })

  it('rejects slots on a different Cyprus calendar day even when the absolute shift is small', () => {
    const originalStart = '2026-06-15T21:30:00.000Z' // 00:30 Cyprus on Jun 16

    expect(isWithinAmendStartWindow('2026-06-15T20:30:00.000Z', originalStart)).toBe(false) // 23:30 Cyprus on Jun 15
    expect(isWithinAmendStartWindow('2026-06-15T22:00:00.000Z', originalStart)).toBe(true) // 01:00 Cyprus on Jun 16
  })

  it('shows pending amendment badges only for active accepted or confirmed amendment proposals', () => {
    const activeAmendment = {
      status: 'confirmed',
      proposal_context: 'amend_start',
      proposed_start: '2026-06-15T11:30:00.000Z',
      proposal_by: 'client',
    } as const

    expect(hasPendingAmendmentRequest(activeAmendment)).toBe(true)
    expect(hasPendingAmendmentRequest({ ...activeAmendment, status: 'accepted' })).toBe(true)
    expect(hasPendingAmendmentRequest({ ...activeAmendment, status: 'pending' })).toBe(false)
    expect(hasPendingAmendmentRequest({ ...activeAmendment, proposal_context: 'post_confirmation' })).toBe(false)
    expect(hasPendingAmendmentRequest({ ...activeAmendment, proposed_start: undefined })).toBe(false)
    expect(hasPendingAmendmentRequest({ ...activeAmendment, proposal_by: null })).toBe(false)
  })

  it('keeps amendment expiry copy focused on the request, not booking cancellation', () => {
    expect(AMENDMENT_EXPIRED_TITLE).toBe('Amend Start Time Request Expired')
    expect(AMENDMENT_EXPIRED_BODY).toContain('The original booking time remains in effect')
    expect(AMENDMENT_EXPIRY_OUTCOME_COPY).toContain('the amendment request will expire')
    expect(AMENDMENT_EXPIRY_OUTCOME_COPY).toContain('the proposed start time is reached')
    expect(AMENDMENT_EXPIRY_OUTCOME_COPY).toContain('the original booking time will remain in effect')
  })

  it('caps amend-start countdown expiry at the proposed start time', () => {
    const expiresAt = '2026-06-15T19:50:00.000Z'
    const proposedStart = '2026-06-15T19:00:00.000Z'

    expect(getEffectiveProposalExpiryMs({
      proposal_context: 'amend_start',
      proposal_expires_at: expiresAt,
      proposed_start: proposedStart,
    })).toBe(new Date(proposedStart).getTime())

    expect(getEffectiveProposalExpiryMs({
      proposal_context: 'post_confirmation',
      proposal_expires_at: expiresAt,
      proposed_start: proposedStart,
    })).toBe(new Date(expiresAt).getTime())
  })
})
