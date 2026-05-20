'use client'

import { useCallback, useEffect, useState } from 'react'
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
import { formatDate, formatCurrency } from '@/lib/utils'
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

const DISPUTE_FILTERS = ['all', 'urgent', 'no_show', 'payment'] as const
type DisputeFilter = (typeof DISPUTE_FILTERS)[number]
const DISPUTE_FILTER_LABELS: Record<DisputeFilter, string> = {
  all: 'All',
  urgent: 'Urgent Safety',
  no_show: 'No-Show',
  payment: 'Payment / Booking',
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
  const resolutionLabel = RESOLUTION_TYPES.find(r => r.value === dispute.resolution_type)?.label

  return (
    <Card>
      <CardContent className="px-5 pb-5 pt-6">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs text-muted-foreground">
                Booking #{dispute.booking_id.slice(0, 8)}
              </span>
              <Badge variant={cfg.variant}>
                <cfg.icon className="h-3 w-3 mr-1" />
                {cfg.label}
              </Badge>
            </div>
            <p className="text-sm font-medium">{dispute.explanation ?? dispute.reason}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Raised {formatDate(dispute.created_at)}
            </p>
            {(dispute.reporter_role || dispute.booking_status_at_report) && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Reporter: {dispute.reporter_role ?? 'unknown'} · Booking status at report: {dispute.booking_status_at_report ?? 'unknown'}
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
            <span className="font-medium">Resolution: </span>
            {resolutionLabel}
            {dispute.refund_amount ? ` — ${formatCurrency(dispute.refund_amount)}` : ''}
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
      </CardContent>
    </Card>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<AdminDispute[]>([])
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
      const res = await adminApi.listDisputes()
      setDisputes(res.data ?? [])
      resetLoadError('admin-disputes')
    } catch {
      reportLoadError('admin-disputes', 'Failed to load disputes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

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

    if (resolveType === 'partial_refund' && refund === null && chargePct === null) {
      toast.error('Enter either refund amount or charge percentage for partial refund.'); return
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
      if (['partial_refund', 'no_refund', 'payment_released'].includes(resolveType) && chargePct !== null) {
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
                {activeByFilter[filter].length}
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
                    ? 'No disputes'
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

            {['partial_refund', 'no_refund', 'payment_released'].includes(resolveType) && (
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
                  placeholder={resolveType === 'partial_refund' ? 'Optional if refund amount is entered' : 'Optional, defaults to 100'}
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
