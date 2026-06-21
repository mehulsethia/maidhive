export type AdminDisputeQueueStage = 'open' | 'awaiting_response' | 'under_review'

type DisputeQueueState = {
  status?: string | null
  respondedAt?: Date | string | null
  respondedBy?: string | null
  responseExplanation?: string | null
}

export function getAdminDisputeQueueStage(dispute: DisputeQueueState): AdminDisputeQueueStage | null {
  if (dispute.status === 'open') return 'open'
  if (dispute.status !== 'under_review') return null

  const hasResponse = Boolean(dispute.respondedAt || dispute.respondedBy || dispute.responseExplanation)

  return hasResponse ? 'under_review' : 'awaiting_response'
}
