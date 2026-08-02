export type DisputeParticipantRole = 'client' | 'cleaner' | 'admin'

export type DisputeActionInput = {
  status?: string | null
  created_at?: string | Date | null
  createdAt?: string | Date | null
  raised_by?: string | null
  raisedBy?: string | null
  reporter_role?: string | null
  reporterRole?: string | null
  responded_by?: string | null
  respondedBy?: string | null
  responder_role?: string | null
  responderRole?: string | null
  responded_at?: string | Date | null
  respondedAt?: string | Date | null
  response_explanation?: string | null
  responseExplanation?: string | null
} | null | undefined

export const DISPUTE_RESPONSE_WINDOW_HOURS = 24
export const DISPUTE_RESPONSE_WINDOW_MS = DISPUTE_RESPONSE_WINDOW_HOURS * 60 * 60 * 1000

export type DisputeParticipantActionKind = 'view_report' | 'add_response' | 'view_response' | 'none'

export type DisputeParticipantAction = {
  kind: DisputeParticipantActionKind
  label: string
}

export function isActiveDisputeStatus(status?: string | null) {
  return status === 'open' || status === 'under_review'
}

export function getDisputeResponseDeadlineMs(dispute: DisputeActionInput) {
  const createdAt = dispute?.created_at ?? dispute?.createdAt ?? null
  if (!createdAt) return null
  const createdMs = new Date(createdAt).getTime()
  if (!Number.isFinite(createdMs)) return null
  return createdMs + DISPUTE_RESPONSE_WINDOW_MS
}

export function isDisputeResponseWindowOpen(dispute: DisputeActionInput, nowMs = Date.now()) {
  const deadlineMs = getDisputeResponseDeadlineMs(dispute)
  return deadlineMs === null || nowMs <= deadlineMs
}

export function getDisputeParticipantAction(
  viewerRole: DisputeParticipantRole,
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

  if (!isDisputeResponseWindowOpen(dispute)) {
    return { kind: 'none', label: '' }
  }

  return { kind: 'add_response', label: 'Add your response' }
}
