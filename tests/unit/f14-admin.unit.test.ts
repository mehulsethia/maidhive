import { describe, expect, it } from 'vitest'
import {
  cleanerLifecycleLabel,
  composeCleanerRejectionMessage,
  deriveCleanerLifecycleStatus,
  rejectionFixGuidance,
} from '@/lib/cleaner-status'

describe('F14 Admin flows unit coverage', () => {
  it('UT-ADMIN-01 cleaner lifecycle classifier maps pending/approved/live/rejected/suspended correctly', () => {
    expect(deriveCleanerLifecycleStatus({ status: 'pending' })).toBe('pending_approval')
    expect(deriveCleanerLifecycleStatus({ status: 'approved', profileComplete: false, stripeOnboardingComplete: true })).toBe('approved')
    expect(deriveCleanerLifecycleStatus({ status: 'approved', profileComplete: true, stripeOnboardingComplete: true })).toBe('live')
    expect(deriveCleanerLifecycleStatus({ status: 'rejected' })).toBe('rejected')
    expect(deriveCleanerLifecycleStatus({ status: 'suspended' })).toBe('suspended')
  })

  it('UT-ADMIN-02 lifecycle labels remain stable for dashboard and queues', () => {
    expect(cleanerLifecycleLabel('pending_approval')).toBe('Pending approval')
    expect(cleanerLifecycleLabel('approved')).toBe('Approved')
    expect(cleanerLifecycleLabel('live')).toBe('Live')
  })

  it('UT-ADMIN-03 rejection message composer combines reason code and custom text deterministically', () => {
    const combined = composeCleanerRejectionMessage({
      reasonCode: 'id_not_clear',
      customMessage: 'Please upload all corners fully visible.',
    })

    expect(combined).toContain('ID not clear')
    expect(combined).toContain('Please upload all corners fully visible.')
    expect(rejectionFixGuidance('id_not_clear')).toContain('government ID')
  })

  it('UT-ADMIN-04 missing rejection reason still yields actionable fallback guidance', () => {
    expect(composeCleanerRejectionMessage({})).toContain('Profile update required')
    expect(rejectionFixGuidance(undefined)).toContain('Review the feedback')
  })
})
