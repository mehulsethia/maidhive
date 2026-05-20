export const DISPUTE_ISSUE_TYPES = [
  'cleaner_no_show',
  'client_no_show',
  'service_issue',
  'service_dispute',
  'safety_concern',
  'property_issue_damage',
  'access_issue',
] as const

export type DisputeIssueType = (typeof DISPUTE_ISSUE_TYPES)[number]

export const NO_SHOW_ISSUE_TYPES: readonly DisputeIssueType[] = [
  'cleaner_no_show',
  'client_no_show',
] as const

export const CLIENT_DISPUTE_ISSUES: ReadonlyArray<{ value: DisputeIssueType; label: string }> = [
  { value: 'cleaner_no_show', label: 'Cleaner no-show' },
  { value: 'service_issue', label: 'Service issue' },
  { value: 'safety_concern', label: 'Safety concern' },
  { value: 'property_issue_damage', label: 'Property issue/damage' },
] as const

export const CLEANER_DISPUTE_ISSUES: ReadonlyArray<{ value: DisputeIssueType; label: string }> = [
  { value: 'client_no_show', label: 'Client no-show' },
  { value: 'access_issue', label: 'Access issue' },
  { value: 'safety_concern', label: 'Safety concern' },
  { value: 'service_dispute', label: 'Service dispute' },
] as const

export const DISPUTE_REASON_LABELS: Record<DisputeIssueType, string> = {
  cleaner_no_show: 'Cleaner no-show',
  client_no_show: 'Client no-show',
  service_issue: 'Service issue',
  service_dispute: 'Service dispute',
  safety_concern: 'Safety concern',
  property_issue_damage: 'Property issue/damage',
  access_issue: 'Access issue',
}
