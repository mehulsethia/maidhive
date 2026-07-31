type DisputeLike = {
  status?: string | null
  issue_type?: string | null
  issueType?: string | null
  no_show_finding?: string | null
  noShowFinding?: string | null
}

export function isResolvedConfirmedCleanerNoShow(dispute?: DisputeLike | null) {
  const status = dispute?.status
  const issueType = dispute?.issue_type ?? dispute?.issueType
  const noShowFinding = dispute?.no_show_finding ?? dispute?.noShowFinding
  return (
    (status === 'resolved' || status === 'closed') &&
    issueType === 'cleaner_no_show' &&
    noShowFinding === 'confirmed'
  )
}

export function canOfferStandardServiceReview(input: {
  completedAt?: string | Date | null
  status?: string | null
  hasReview?: boolean
  reviewWindowOpened?: boolean
  activeDispute?: boolean
  dispute?: DisputeLike | null
}) {
  return Boolean(input.completedAt) &&
    (input.status === 'completed' || input.status === 'disputed') &&
    !input.hasReview &&
    Boolean(input.reviewWindowOpened) &&
    !input.activeDispute &&
    !isResolvedConfirmedCleanerNoShow(input.dispute)
}
