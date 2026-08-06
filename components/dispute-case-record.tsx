import { CalendarDays } from 'lucide-react'
import {
  getCounterpartyRole,
  getDisputeActorLabel,
  getDisputeCreatedAt,
  getDisputeEvidence,
  getDisputeRespondedAt,
  getDisputeResponseExplanation,
  getDisputeResolvedAt,
  hasCounterpartyResponse,
  type DisputeCaseInput,
} from '@/lib/dispute-case'
import { getDisputeResolutionOutcome } from '@/lib/dispute-resolution'
import { cn, formatDate } from '@/lib/utils'

export function DisputeCaseRecord({
  dispute,
  className,
  noResponseCopy = 'No counterparty response submitted.',
}: {
  dispute: DisputeCaseInput
  className?: string
  noResponseCopy?: string
}) {
  const reporterRole = dispute.reporter_role ?? dispute.reporterRole ?? null
  const responderRole = dispute.responder_role ?? dispute.responderRole ?? getCounterpartyRole(reporterRole)
  const reporterLabel = getDisputeActorLabel(reporterRole)
  const responderLabel = getDisputeActorLabel(responderRole)
  const originalEvidence = getDisputeEvidence(dispute, 'original')
  const responseEvidence = getDisputeEvidence(dispute, 'response')
  const createdAt = getDisputeCreatedAt(dispute)
  const respondedAt = getDisputeRespondedAt(dispute)
  const resolvedAt = getDisputeResolvedAt(dispute)
  const responseExplanation = getDisputeResponseExplanation(dispute)
  const resolved = dispute.status === 'resolved' || dispute.status === 'closed'
  const resolutionNote = dispute.resolution_note ?? dispute.resolutionNote ?? null
  const refundAmountValue = Number(dispute.refund_amount ?? dispute.refundAmount ?? 0)
  const refundAmount = Number.isFinite(refundAmountValue) ? refundAmountValue : undefined

  return (
    <div className={cn('space-y-2 text-sm text-slate-700', className)}>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Original report
        </p>
        <p className="mt-1 text-xs font-medium text-slate-600">
          Submitted by {reporterLabel.toLowerCase()}
          {createdAt ? ` · ${formatDate(createdAt)}` : ''}
        </p>
        {dispute.reason && <p className="mt-1 font-medium text-slate-900">{dispute.reason}</p>}
        {dispute.explanation && <p className="mt-1 text-slate-700">{dispute.explanation}</p>}
        <EvidenceLinks links={originalEvidence} label={`${reporterLabel} evidence`} />
      </div>

      {hasCounterpartyResponse(dispute) ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Counterparty response
          </p>
          <p className="mt-1 text-xs font-medium text-amber-700">
            Response submitted by {responderLabel.toLowerCase()}
            {respondedAt ? ` · ${formatDate(respondedAt)}` : ''}
          </p>
          {responseExplanation && <p className="mt-1 text-amber-950">{responseExplanation}</p>}
          <EvidenceLinks links={responseEvidence} label={`${responderLabel} evidence`} />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
          {noResponseCopy}
        </p>
      )}

      {resolved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Final resolution outcome
          </p>
          <p className="mt-1 font-medium text-emerald-950">
            {getDisputeResolutionOutcome(dispute.resolution_type ?? dispute.resolutionType, refundAmount)}
          </p>
          {resolutionNote && (
            <p className="mt-2 text-emerald-900">
              {resolutionNote}
            </p>
          )}
          {resolvedAt && (
            <p className="mt-2 text-xs font-medium text-emerald-700">
              Resolution date: {formatDate(resolvedAt)}
            </p>
          )}
        </div>
      )}

      <div className="space-y-1 text-xs text-slate-500">
        {createdAt && (
          <div className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            Reported on: {formatDate(createdAt)}
          </div>
        )}
        {respondedAt && (
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            Response submitted on: {formatDate(respondedAt)}
          </div>
        )}
      </div>
    </div>
  )
}

function EvidenceLinks({ links, label }: { links: string[]; label: string }) {
  if (links.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {links.map((link, index) => (
        <a
          key={`${link}-${index}`}
          href={link}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
        >
          {label} {index + 1}
        </a>
      ))}
    </div>
  )
}
