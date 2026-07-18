export type AdminCancellationQueueSeverity = 'low' | 'medium' | 'high' | 'critical'

export type AdminCancellationQueueClassification = {
  label: string
  severity: AdminCancellationQueueSeverity
  sortPriority: number
  leadTimeHours: number | null
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle))
}

function actorFromReason(reason: string | null | undefined) {
  const normalized = reason?.toLowerCase() ?? ''
  if (includesAny(normalized, ['cleaner cancelled', 'cancelled by cleaner', 'cleaner cancellation'])) {
    return 'cleaner'
  }
  if (includesAny(normalized, ['client cancelled', 'cancelled by client', 'client cancellation'])) {
    return 'client'
  }
  return null
}

function noShowActor(input: {
  issueType?: string | null
  reporterRole?: string | null
  reason?: string | null
}) {
  const issueType = input.issueType?.toLowerCase() ?? ''
  const reason = input.reason?.toLowerCase() ?? ''
  if (issueType === 'cleaner_no_show' || reason.includes('cleaner no-show')) return 'cleaner'
  if (issueType === 'client_no_show' || reason.includes('client no-show')) return 'client'
  if (input.reporterRole === 'client') return 'cleaner'
  if (input.reporterRole === 'cleaner') return 'client'
  return null
}

export function classifyAdminCancellationQueueItem(input: {
  category: 'cancellation' | 'no_show'
  reason?: string | null
  issueType?: string | null
  reporterRole?: string | null
  cancelledByRole?: string | null
  scheduledStart?: Date | string | null
  occurredAt?: Date | string | null
}): AdminCancellationQueueClassification {
  if (input.category === 'no_show') {
    const actor = noShowActor(input)
    if (actor === 'cleaner') {
      return {
        label: 'Cleaner no-show',
        severity: 'critical',
        sortPriority: 50,
        leadTimeHours: null,
      }
    }
    if (actor === 'client') {
      return {
        label: 'Client no-show',
        severity: 'high',
        sortPriority: 40,
        leadTimeHours: null,
      }
    }
    return {
      label: 'No-show',
      severity: 'high',
      sortPriority: 35,
      leadTimeHours: null,
    }
  }

  const scheduledStart = input.scheduledStart ? new Date(input.scheduledStart) : null
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : null
  const leadTimeHours =
    scheduledStart && occurredAt
      ? (scheduledStart.getTime() - occurredAt.getTime()) / (60 * 60 * 1000)
      : null
  const actor =
    input.cancelledByRole === 'cleaner' || input.cancelledByRole === 'client'
      ? input.cancelledByRole
      : actorFromReason(input.reason)

  if (actor === 'cleaner') {
    if (leadTimeHours !== null && leadTimeHours < 12) {
      return {
        label: 'Cleaner cancellation (<12 hours)',
        severity: 'high',
        sortPriority: 30,
        leadTimeHours,
      }
    }
    if (leadTimeHours !== null && leadTimeHours <= 24) {
      return {
        label: 'Cleaner cancellation (12-24 hours)',
        severity: 'medium',
        sortPriority: 20,
        leadTimeHours,
      }
    }
    return {
      label: 'Cleaner cancellation (>24 hours)',
      severity: 'low',
      sortPriority: 10,
      leadTimeHours,
    }
  }

  if (actor === 'client') {
    return {
      label: 'Client cancellation',
      severity: 'low',
      sortPriority: 5,
      leadTimeHours,
    }
  }

  return {
    label: 'Cancellation',
    severity: 'medium',
    sortPriority: 15,
    leadTimeHours,
  }
}
