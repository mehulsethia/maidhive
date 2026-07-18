import { describe, expect, it } from 'vitest'
import { classifyAdminCancellationQueueItem } from '@/lib/admin-cancellation-severity'

describe('admin cancellation queue severity', () => {
  it('classifies cleaner cancellations by actual timing band', () => {
    expect(
      classifyAdminCancellationQueueItem({
        category: 'cancellation',
        cancelledByRole: 'cleaner',
        scheduledStart: new Date('2026-07-17T14:30:00.000Z'),
        occurredAt: new Date('2026-07-16T22:56:00.000Z'),
      }),
    ).toMatchObject({
      label: 'Cleaner cancellation (12–24 hours)',
      severity: 'medium',
      sortPriority: 20,
    })

    expect(
      classifyAdminCancellationQueueItem({
        category: 'cancellation',
        cancelledByRole: 'cleaner',
        scheduledStart: new Date('2026-07-17T14:30:00.000Z'),
        occurredAt: new Date('2026-07-17T06:31:00.000Z'),
      }),
    ).toMatchObject({
      label: 'Cleaner cancellation (<12 hours)',
      severity: 'high',
      sortPriority: 30,
    })
  })

  it('keeps client cancellations separate from cleaner operational incidents', () => {
    expect(
      classifyAdminCancellationQueueItem({
        category: 'cancellation',
        cancelledByRole: 'client',
        scheduledStart: new Date('2026-07-17T14:30:00.000Z'),
        occurredAt: new Date('2026-07-17T06:31:00.000Z'),
      }),
    ).toMatchObject({
      label: 'Client cancellation',
      severity: 'low',
      sortPriority: 5,
    })
  })

  it('prioritises no-show records by actor', () => {
    expect(
      classifyAdminCancellationQueueItem({
        category: 'no_show',
        issueType: 'cleaner_no_show',
      }),
    ).toMatchObject({
      label: 'Cleaner no-show',
      severity: 'critical',
      sortPriority: 50,
    })

    expect(
      classifyAdminCancellationQueueItem({
        category: 'no_show',
        issueType: 'client_no_show',
      }),
    ).toMatchObject({
      label: 'Client no-show',
      severity: 'high',
      sortPriority: 40,
    })
  })
})
