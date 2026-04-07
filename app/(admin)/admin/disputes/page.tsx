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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LoadingSpinner } from '@/components/loading-spinner'
import { EmptyState } from '@/components/empty-state'
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
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
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
            <p className="text-sm font-medium">{dispute.reason}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Raised {formatDate(dispute.created_at)}
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            {dispute.status === 'open' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onMarkUnderReview}
                  disabled={actionLoading}
                >
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  Start review
                </Button>
                <Button size="sm" onClick={onResolve} disabled={actionLoading}>
                  Resolve
                </Button>
              </>
            )}
            {dispute.status === 'under_review' && (
              <Button size="sm" onClick={onResolve} disabled={actionLoading}>
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
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Resolve dialog
  const [resolveTarget, setResolveTarget] = useState<AdminDispute | null>(null)
  const [resolveType, setResolveType] = useState('no_refund')
  const [resolveNote, setResolveNote] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [resolving, setResolving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.listDisputes()
      setDisputes(res.data ?? [])
    } catch {
      toast.error('Failed to load disputes.')
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
    if (resolveType === 'partial_refund' && !refundAmount) {
      toast.error('Enter the refund amount.'); return
    }

    setResolving(true)
    try {
      await adminApi.resolveDispute(resolveTarget.id, {
        resolution_type: resolveType,
        resolution_note: resolveNote,
        refund_amount: resolveType === 'partial_refund' ? Number(refundAmount) : null,
      })
      toast.success('Dispute resolved.')
      setResolveTarget(null)
      setResolveNote('')
      setRefundAmount('')
      setResolveType('no_refund')
      load()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to resolve dispute.')
    } finally {
      setResolving(false)
    }
  }

  if (loading) return <LoadingSpinner />

  const open = disputes.filter(d => d.status === 'open')
  const underReview = disputes.filter(d => d.status === 'under_review')
  const resolved = disputes.filter(d => ['resolved', 'closed'].includes(d.status))

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Disputes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage and resolve client–cleaner disputes</p>
      </div>

      {open.length > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {open.length} open dispute{open.length !== 1 ? 's' : ''} require{open.length === 1 ? 's' : ''} attention
        </div>
      )}

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open" className="gap-1.5">
            Open
            {open.length > 0 && (
              <span className="h-4 w-4 rounded-full bg-red-100 text-red-700 text-[10px] flex items-center justify-center font-medium">
                {open.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="under_review">
            Under review ({underReview.length})
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved ({resolved.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="space-y-3 mt-4">
          {open.length === 0 ? (
            <EmptyState title="No open disputes" description="All disputes have been handled." />
          ) : (
            open.map(d => (
              <DisputeCard
                key={d.id}
                dispute={d}
                actionLoading={actionLoading === d.id}
                onMarkUnderReview={() => markUnderReview(d)}
                onResolve={() => setResolveTarget(d)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="under_review" className="space-y-3 mt-4">
          {underReview.length === 0 ? (
            <EmptyState title="No disputes under review" />
          ) : (
            underReview.map(d => (
              <DisputeCard
                key={d.id}
                dispute={d}
                actionLoading={actionLoading === d.id}
                onResolve={() => setResolveTarget(d)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-3 mt-4">
          {resolved.length === 0 ? (
            <EmptyState title="No resolved disputes" />
          ) : (
            resolved.map(d => (
              <DisputeCard key={d.id} dispute={d} actionLoading={false} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Resolve dialog */}
      <Dialog
        open={!!resolveTarget}
        onClose={() => { setResolveTarget(null); setResolveNote(''); setRefundAmount(''); setResolveType('no_refund') }}
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

            {(resolveType === 'full_refund' || resolveType === 'partial_refund') && (
              <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded px-3 py-2 text-blue-700">
                Note: Stripe refund must be processed manually in the Stripe Dashboard after saving this resolution.
              </p>
            )}

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
