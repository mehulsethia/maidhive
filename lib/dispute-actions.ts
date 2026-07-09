type ParticipantRole = 'client' | 'cleaner' | 'admin'

type DisputeActionInput = {
  status?: string | null
  raised_by?: string | null
  raisedBy?: string | null
  reporter_role?: ParticipantRole | null
  reporterRole?: ParticipantRole | null
  responded_by?: string | null
  respondedBy?: string | null
  responder_role?: ParticipantRole | null
  responderRole?: ParticipantRole | null
  responded_at?: string | null
  respondedAt?: string | null
  response_explanation?: string | null
  responseExplanation?: string | null
} | null | undefined

export type DisputeParticipantActionKind = 'view_report' | 'add_response' | 'view_response' | 'none'

export type DisputeParticipantAction = {
  kind: DisputeParticipantActionKind
  label: string
}

export function isActiveDisputeStatus(status?: string | null) {
  return status === 'open' || status === 'under_review'
}

export function getDisputeParticipantAction(
  viewerRole: ParticipantRole,
  dispute: DisputeActionInput,
  currentUserId?: string | null,
): DisputeParticipantAction {
  if (!dispute || !isActiveDisputeStatus(dispute.status)) {
    return { kind: 'none', label: '' }
  }

  const reporterRole = dispute.reporter_role ?? dispute.reporterRole ?? null
  const responderRole = dispute.responder_role ?? dispute.responderRole ?? null
  const raisedBy = dispute.raised_by ?? dispute.raisedBy ?? null
  const respondedBy = dispute.responded_by ?? dispute.respondedBy ?? null
  const respondedAt = dispute.responded_at ?? dispute.respondedAt ?? null
  const responseExplanation = dispute.response_explanation ?? dispute.responseExplanation ?? null
  const hasResponse = Boolean(responderRole || respondedBy || respondedAt || responseExplanation)

  if (reporterRole === viewerRole || (currentUserId && raisedBy === currentUserId)) {
    return { kind: 'view_report', label: 'View report details' }
  }

  if (hasResponse) {
    return { kind: 'view_response', label: 'View your response' }
  }

  return { kind: 'add_response', label: 'Add your response' }
}
