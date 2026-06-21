import { describe, expect, it } from 'vitest'
import { getAdminDisputeQueueStage } from '@/lib/admin-dispute-queue'

describe('admin dispute queue categorisation', () => {
  it('keeps newly open disputes in the open bucket', () => {
    expect(getAdminDisputeQueueStage({ status: 'open' })).toBe('open')
  })

  it('marks under-review disputes without a response as awaiting response', () => {
    expect(getAdminDisputeQueueStage({ status: 'under_review' })).toBe('awaiting_response')
  })

  it('marks a responded dispute as ready for admin review', () => {
    expect(
      getAdminDisputeQueueStage({
        status: 'under_review',
        respondedAt: new Date('2026-06-19T04:03:00.000Z'),
      }),
    ).toBe('under_review')
  })

  it('does not put resolved disputes in an active bucket', () => {
    expect(getAdminDisputeQueueStage({ status: 'resolved', respondedBy: 'user-1' })).toBeNull()
  })
})
