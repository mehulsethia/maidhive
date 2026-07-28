import { isDisputeResponseWindowOpen } from '@/lib/dispute-actions'

export type AdminDisputeQueueStage = 'open' | 'awaiting_response' | 'under_review'

type DisputeQueueState = {
  status?: string | null
  createdAt?: Date | string | null
  created_at?: Date | string | null
  respondedAt?: Date | string | null
  responded_at?: Date | string | null
  respondedBy?: string | null
  responded_by?: string | null
  responseExplanation?: string | null
  response_explanation?: string | null
}

export function getAdminDisputeQueueStage(dispute: DisputeQueueState): AdminDisputeQueueStage | null {
  if (dispute.status === 'open') return 'open'
  if (dispute.status !== 'under_review') return null

  const hasResponse = Boolean(
    dispute.respondedAt ||
    dispute.responded_at ||
    dispute.respondedBy ||
    dispute.responded_by ||
    dispute.responseExplanation ||
    dispute.response_explanation,
  )

  if (hasResponse) return 'under_review'

  return isDisputeResponseWindowOpen(dispute) ? 'awaiting_response' : 'under_review'
}
