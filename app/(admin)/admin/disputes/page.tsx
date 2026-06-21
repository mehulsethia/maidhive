'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingSpinner } from '@/components/loading-spinner'
import { EmptyState } from '@/components/empty-state'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { formatDate } from '@/lib/utils'
import { getDisputeResolutionOutcome } from '@/lib/dispute-resolution'
import type { AdminDispute } from '@/types'
import { toast } from 'sonner'

const RESOLUTION_TYPES = [
  { value: 'full_refund',       label: 'Full refund to client' },
  { value: 'partial_refund',    label: 'Partial refund (enter amount below)' },
  { value: 'no_refund',         label: 'No refund — release payment to cleaner' },
  { value: 'payment_released',  label: 'Dispute withdrawn — release payment' },
]

const STATUS_CONFIG: Record<string, { variant: any; label: string; icon: React.ElementType }> = {
  open:         { variant: 'destructive', label: 'Open',         icon: AlertTriangle },
  under_review: { variant: 'warning',     label: 'Under review', icon: Clock },
  resolved:     { variant: 'success',     label: 'Resolved',     icon: CheckCircle2 },
  closed:       { variant: 'secondary',   label: 'Closed',       icon: CheckCircle2 },
}

const ISSUE_QUEUE_LABEL: Record<string, string> = {
  cleaner_no_show: 'No-Show',
  client_no_show: 'No-Show',
  service_issue: 'Payment / Booking',
  service_dispute: 'Payment / Booking',
  safety_concern: 'Urgent Safety',
  property_issue_damage: 'Urgent Safety',
  access_issue: 'Payment / Booking',
}

const DISPUTE_FILTERS = ['all', 'urgent', 'no_show', 'payment', 'resolved'] as const
type DisputeFilter = (typeof DISPUTE_FILTERS)[number]
const DISPUTE_FILTER_LABELS: Record<DisputeFilter, string> = {
  all: 'Active',
  urgent: 'Urgent Safety',
  no_show: 'No-Show',
  payment: 'Payment / Booking',
  resolved: 'Resolved Disputes',
}

function classifyQueue(dispute: AdminDispute): 'urgent' | 'no_show' | 'payment' {
  const issueType = String(dispute.issue_type ?? '')
  if (['safety_concern', 'property_issue_damage', 'misconduct', 'aggressive_behaviour', 'theft_allegation'].includes(issueType)) {
    return 'urgent'
  }
  if (['cleaner_no_show', 'client_no_show'].includes(issueType)) {
    return 'no_show'
  }
  return 'payment'
}

function getEvidenceLinks(value?: string[] | null) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

// ── Dispute card ──────────────────────────────────────────────────────────────

function DisputeCard({
  dispute,
  onMarkUnderReview,
  onResolve,
  actionLoading,
}: {
  dispute: AdminDispute
  onMarkUnderReview?: () => void
  onResolve?: () => void
  actionLoading: boolean
}) {
  const cfg = STATUS_CONFIG[dispute.status] ?? STATUS_CONFIG.closed
  const resolutionLabel = ['resolved', 'closed'].includes(dispute.status)
    ? getDisputeResolutionOutcome(dispute.resolution_type, dispute.refund_amount)
    : null
  const originalEvidence = getEvidenceLinks(dispute.evidence)
  const responseEvidence = getEvidenceLinks(dispute.response_evidence)
  const clientName = dispute.booking?.client?.user?.name?.trim() || 'Not recorded'
  const cleanerName = dispute.booking?.cleaner?.user?.name?.trim() || 'Not recorded'
  const reporterLabel = dispute.reporter_role
    ? `${dispute.reporter_role.charAt(0).toUpperCase()}${dispute.reporter_role.slice(1)} Report`
    : 'Reporter Unknown'

  return (
    <Card>
      <CardContent className="px-5 pb-5 pt-6">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs text-muted-foreground">
                Booking #{dispute.booking_id.slice(0, 8)}
              </span>
              <Badge variant="outline">{reporterLabel}</Badge>
              <Badge variant={cfg.variant}>
                <cfg.icon className="h-3 w-3 mr-1" />
                {cfg.label}
              </Badge>
            </div>
            <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              <p><span className="font-medium text-slate-700">Client:</span> {clientName}</p>
              <p><span className="font-medium text-slate-700">Cleaner:</span> {cleanerName}</p>
            </div>
            <div className="mt-2 space-y-2 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Original report</p>
                <p className="mt-1 font-medium">{dispute.reason}</p>
                {dispute.explanation && <p className="mt-1 text-muted-foreground">{dispute.explanation}</p>}
                <EvidenceLinks links={originalEvidence} />
              </div>
              {dispute.response_explanation ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Counterparty response</p>
                  <p className="mt-1 text-amber-950">{dispute.response_explanation}</p>
                  <EvidenceLinks links={responseEvidence} />
                  {dispute.responder_role && (
                    <p className="mt-1 text-xs text-amber-700">
                      Responded by: {dispute.responder_role}
                      {dispute.responded_at ? ` · ${formatDate(dispute.responded_at)}` : ''}
                    </p>
                  )}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-muted-foreground">
                  No counterparty response submitted.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Raised {formatDate(dispute.created_at)}
            </p>
            {dispute.booking_status_at_report && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Booking status at report: {dispute.booking_status_at_report}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              Queue: {ISSUE_QUEUE_LABEL[String(dispute.issue_type ?? 'service_issue')] ?? 'Payment / Booking'}
            </p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">
            {dispute.status === 'open' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onMarkUnderReview}
                  disabled={actionLoading}
                  className="w-full sm:w-auto"
                >
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  Start review
                </Button>
                <Button size="sm" onClick={onResolve} disabled={actionLoading} className="w-full sm:w-auto">
                  Resolve
                </Button>
              </>
            )}
            {dispute.status === 'under_review' && (
              <Button size="sm" onClick={onResolve} disabled={actionLoading} className="w-full sm:w-auto">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Resolve
              </Button>
            )}
          </div>
        </div>

        {resolutionLabel && (
          <div className="mt-2 text-xs bg-green-50 border border-green-200 rounded px-3 py-2 text-green-800">
            <span className="font-medium">Resolution outcome: </span>
            {resolutionLabel}
          </div>
        )}
        {dispute.resolution_note && (
          <p className="text-xs text-muted-foreground mt-2 bg-muted rounded px-3 py-1.5 italic">
            "{dispute.resolution_note}"
          </p>
        )}
        {dispute.resolved_at && (
          <p className="text-xs text-muted-foreground mt-1">
            Resolved {formatDate(dispute.resolved_at)}
          </p>
        )}
        {['resolved', 'closed'].includes(dispute.status) && (
          <Link
            href={`/admin/bookings/${dispute.booking_id}`}
            className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            View booking history
          </Link>
        )}
      </CardContent>
    </Card>
  )
}

function EvidenceLinks({ links }: { links: string[] }) {
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
          Evidence {index + 1}
        </a>
      ))}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<AdminDispute[]>([])
  const [resolvedDisputes, setResolvedDisputes] = useState<AdminDispute[]>([])
  const [resolvedTotal, setResolvedTotal] = useState(0)
  const [resolvedPage, setResolvedPage] = useState(1)
  const [loadingMoreResolved, setLoadingMoreResolved] = useState(false)
  const [activeFilter, setActiveFilter] = useState<DisputeFilter>('all')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Resolve dialog
  const [resolveTarget, setResolveTarget] = useState<AdminDispute | null>(null)
  const [resolveType, setResolveType] = useState('no_refund')
  const [resolveNote, setResolveNote] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [chargePercentage, setChargePercentage] = useState('')
  const [resolving, setResolving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [activeRes, resolvedRes] = await Promise.all([
        adminApi.listDisputes({ status: 'active', page: 1, page_size: 50 }),
        adminApi.listDisputes({ status: 'resolved', page: 1, page_size: 50 }),
      ])
      setDisputes(activeRes.data?.items ?? [])
      setResolvedDisputes(resolvedRes.data?.items ?? [])
      setResolvedTotal(resolvedRes.data?.total ?? 0)
      setResolvedPage(1)
      resetLoadError('admin-disputes')
    } catch {
      reportLoadError('admin-disputes', 'Failed to load disputes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function loadMoreResolved() {
    const nextPage = resolvedPage + 1
    setLoadingMoreResolved(true)
    try {
      const res = await adminApi.listDisputes({ status: 'resolved', page: nextPage, page_size: 50 })
      setResolvedDisputes((current) => [...current, ...(res.data?.items ?? [])])
      setResolvedTotal(res.data?.total ?? resolvedTotal)
      setResolvedPage(nextPage)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load more resolved disputes.')
    } finally {
      setLoadingMoreResolved(false)
    }
  }

  async function markUnderReview(dispute: AdminDispute) {
    setActionLoading(dispute.id)
    try {
      await adminApi.markDisputeUnderReview(dispute.id)
      toast.success('Dispute marked as under review.')
      load()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update dispute.')
    } finally {
      setActionLoading(null)
    }
  }

  async function submitResolve() {
    if (!resolveTarget) return
    if (!resolveNote.trim()) { toast.error('Please add a resolution note.'); return }

    const refund = refundAmount.trim() ? Number(refundAmount) : null
    const chargePct = chargePercentage.trim() ? Number(chargePercentage) : null

    if (resolveType === 'partial_refund' && refund === null) {
      toast.error('Enter a refund amount for partial refund.'); return
    }

    if (chargePct !== null && (Number.isNaN(chargePct) || chargePct < 1 || chargePct > 100)) {
      toast.error('Charge percentage must be between 1 and 100.'); return
    }

    if (refund !== null && (Number.isNaN(refund) || refund <= 0)) {
      toast.error('Refund amount must be greater than 0.'); return
    }

    setResolving(true)
    try {
      const payload: {
        resolution_type: string
        resolution_note: string
        refund_amount?: number
        charge_percentage?: number
      } = {
        resolution_type: resolveType,
        resolution_note: resolveNote,
      }
      if (resolveType === 'partial_refund' && refund !== null) {
        payload.refund_amount = refund
      }
      if (['no_refund', 'payment_released'].includes(resolveType) && chargePct !== null) {
        payload.charge_percentage = chargePct
      }

      await adminApi.resolveDispute(resolveTarget.id, {
        ...payload,
      })
      toast.success('Dispute resolved.')
      setResolveTarget(null)
      setResolveNote('')
      setRefundAmount('')
      setChargePercentage('')
      setResolveType('no_refund')
      load()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to resolve dispute.')
    } finally {
      setResolving(false)
    }
  }

  if (loading) return <LoadingSpinner />

  const active = disputes.filter(d => ['open', 'under_review'].includes(d.status))
  const urgent = active.filter((d) => classifyQueue(d) === 'urgent')
  const noShow = active.filter((d) => classifyQueue(d) === 'no_show')
  const paymentBooking = active.filter((d) => classifyQueue(d) === 'payment')
  const activeByFilter: Record<DisputeFilter, AdminDispute[]> = {
    all: active,
    urgent,
    no_show: noShow,
    payment: paymentBooking,
    resolved: resolvedDisputes,
  }

  return (
    <div className="space-y-6 w-full">
      {active.length > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {active.length} active dispute{active.length !== 1 ? 's' : ''} require{active.length === 1 ? 's' : ''} attention
        </div>
      )}
      <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as DisputeFilter)}>
        <TabsList className="scrollbar-hide h-auto w-full justify-start gap-1 overflow-x-auto whitespace-nowrap pb-1 [-webkit-overflow-scrolling:touch]">
          {DISPUTE_FILTERS.map((filter) => (
            <TabsTrigger key={filter} value={filter} className="gap-1.5">
              {DISPUTE_FILTER_LABELS[filter]}
              <span className="text-xs text-muted-foreground">
                {filter === 'resolved' ? resolvedTotal : activeByFilter[filter].length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {DISPUTE_FILTERS.map((filter) => (
          <TabsContent key={filter} value={filter} className="mt-4">
            {activeByFilter[filter].length === 0 ? (
              <EmptyState
                title={
                  filter === 'all'
                    ? 'No active disputes'
                    : filter === 'resolved'
                      ? 'No resolved disputes'
                    : `No ${DISPUTE_FILTER_LABELS[filter].toLowerCase()} disputes`
                }
              />
            ) : (
              <div className="space-y-3">
                {activeByFilter[filter].map((d) => (
                  <DisputeCard
                    key={d.id}
                    dispute={d}
                    actionLoading={actionLoading === d.id}
                    onMarkUnderReview={() => markUnderReview(d)}
                    onResolve={() => setResolveTarget(d)}
                  />
                ))}
                {filter === 'resolved' && resolvedDisputes.length < resolvedTotal && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      onClick={loadMoreResolved}
                      loading={loadingMoreResolved}
                      className="w-full sm:w-auto"
                    >
                      Load more resolved disputes
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Resolve dialog */}
      <Dialog
        open={!!resolveTarget}
        onClose={() => {
          setResolveTarget(null)
          setResolveNote('')
          setRefundAmount('')
          setChargePercentage('')
          setResolveType('no_refund')
        }}
      >
        <DialogTitle>Resolve dispute</DialogTitle>
        {resolveTarget && (
          <div className="space-y-4 mt-2">
            <div className="bg-muted rounded-lg p-3 text-sm">
              <p className="text-xs text-muted-foreground mb-1">Booking #{resolveTarget.booking_id.slice(0, 8)}</p>
              <p className="font-medium">{resolveTarget.reason}</p>
            </div>

            <div>
              <Label>Resolution type</Label>
              <Select
                value={resolveType}
                onChange={e => setResolveType(e.target.value)}
                className="mt-1"
              >
                {RESOLUTION_TYPES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
            </div>

            {resolveType === 'partial_refund' && (
              <div>
                <Label>Refund amount (€)</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={refundAmount}
                    onChange={e => setRefundAmount(e.target.value)}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}

            {['no_refund', 'payment_released'].includes(resolveType) && (
              <div>
                <Label>Charge percentage (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={chargePercentage}
                  onChange={e => setChargePercentage(e.target.value)}
                  className="mt-1"
                  placeholder="Optional, defaults to 100"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Use this to capture only part of the authorized amount.
                </p>
              </div>
            )}

            <div>
              <Label>Resolution note</Label>
              <Textarea
                value={resolveNote}
                onChange={e => setResolveNote(e.target.value)}
                placeholder="Explain your decision clearly. This will be visible to both parties."
                className="mt-1"
                rows={3}
              />
            </div>

            <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded px-3 py-2 text-blue-700">
              This action applies the payment outcome immediately for this dispute.
            </p>

            <Button
              onClick={submitResolve}
              loading={resolving}
              className="w-full"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Confirm resolution
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  )
}
