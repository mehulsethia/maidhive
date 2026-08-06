import { getDisputeResponseDeadlineMs, isActiveDisputeStatus, type DisputeActionInput, type DisputeParticipantRole } from '@/lib/dispute-actions'
import { formatDate } from '@/lib/utils'

export type DisputeCaseInput = DisputeActionInput & {
  reason?: string | null
  explanation?: string | null
  evidence?: unknown
  response_evidence?: unknown
  responseEvidence?: unknown
  resolution_type?: string | null
  resolutionType?: string | null
  resolution_note?: string | null
  resolutionNote?: string | null
  refund_amount?: unknown
  refundAmount?: unknown
  resolved_at?: string | Date | null
  resolvedAt?: string | Date | null
}

export function getDisputeCaseStatusLabel(dispute?: DisputeCaseInput | null) {
  const status = dispute?.status
  if (isActiveDisputeStatus(status)) return 'Under Review'
  if (status === 'resolved' || status === 'closed') return 'Resolved'
  return null
}

export function getDisputeCaseStatusVariant(dispute?: DisputeCaseInput | null) {
  const status = dispute?.status
  if (isActiveDisputeStatus(status)) return 'warning' as const
  if (status === 'resolved' || status === 'closed') return 'success' as const
  return 'secondary' as const
}

export function getDisputeActorLabel(role?: string | null) {
  if (role === 'client') return 'Client'
  if (role === 'cleaner') return 'Cleaner'
  if (role === 'admin') return 'Admin'
  return 'Reporter'
}

export function getCounterpartyRole(reporterRole?: string | null): DisputeParticipantRole | null {
  if (reporterRole === 'client') return 'cleaner'
  if (reporterRole === 'cleaner') return 'client'
  return null
}

export function getDisputeResponseDeadline(dispute?: DisputeCaseInput | null) {
  const deadlineMs = getDisputeResponseDeadlineMs(dispute)
  return deadlineMs === null ? null : new Date(deadlineMs)
}

export function getDisputeResponseDeadlineLabel(dispute?: DisputeCaseInput | null) {
  const deadline = getDisputeResponseDeadline(dispute)
  return deadline ? `Response required by: ${formatDate(deadline)}` : null
}

export function getCounterpartyResponseInstruction(dispute?: DisputeCaseInput | null) {
  const deadline = getDisputeResponseDeadlineLabel(dispute)
  return deadline
    ? `Submit one response and any supporting evidence within 24 hours of the dispute notification. ${deadline}`
    : 'Submit one response and any supporting evidence within 24 hours of the dispute notification.'
}

export function getDisputeCreatedAt(dispute?: DisputeCaseInput | null) {
  return dispute?.created_at ?? dispute?.createdAt ?? null
}

export function getDisputeRespondedAt(dispute?: DisputeCaseInput | null) {
  return dispute?.responded_at ?? dispute?.respondedAt ?? null
}

export function getDisputeResolvedAt(dispute?: DisputeCaseInput | null) {
  return dispute?.resolved_at ?? dispute?.resolvedAt ?? null
}

export function getDisputeResponseExplanation(dispute?: DisputeCaseInput | null) {
  return dispute?.response_explanation ?? dispute?.responseExplanation ?? ''
}

export function getDisputeEvidence(dispute: DisputeCaseInput | null | undefined, field: 'original' | 'response') {
  const value =
    field === 'response'
      ? dispute?.response_evidence ?? dispute?.responseEvidence
      : dispute?.evidence
  return Array.isArray(value) ? value.filter(Boolean) : []
}

export function hasCounterpartyResponse(dispute?: DisputeCaseInput | null) {
  return Boolean(
    getDisputeResponseExplanation(dispute) ||
    getDisputeEvidence(dispute, 'response').length ||
    dispute?.responded_by ||
    dispute?.respondedBy ||
    dispute?.responder_role ||
    dispute?.responderRole ||
    getDisputeRespondedAt(dispute),
  )
}
