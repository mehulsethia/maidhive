'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Star,
  XCircle,
} from 'lucide-react'
import { adminApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LoadingSpinner } from '@/components/loading-spinner'
import { EmptyState } from '@/components/empty-state'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { AdminCleaner } from '@/types'
import { toast } from 'sonner'

type Tab = 'pending' | 'approved' | 'suspended' | 'rejected'

const TAB_STATUS: Tab[] = ['pending', 'approved', 'suspended', 'rejected']

const STATUS_BADGE: Record<string, { variant: any; label: string }> = {
  pending:   { variant: 'warning',     label: 'Pending' },
  approved:  { variant: 'success',     label: 'Approved' },
  suspended: { variant: 'destructive', label: 'Suspended' },
  rejected:  { variant: 'secondary',   label: 'Rejected' },
}

function CleanerCard({
  cleaner,
  onApprove,
  onReject,
  onToggleSuspend,
  loading,
}: {
  cleaner: AdminCleaner
  onApprove?: () => void
  onReject?: () => void
  onToggleSuspend?: () => void
  loading: boolean
}) {
  const sb = STATUS_BADGE[cleaner.status]
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-semibold">{cleaner.user_name}</span>
              <Badge variant={sb.variant}>{sb.label}</Badge>
              {cleaner.identity_verified && (
                <Badge variant="outline" className="text-[10px] py-0">ID verified</Badge>
              )}
              {cleaner.stripe_onboarding_complete && (
                <Badge variant="outline" className="text-[10px] py-0">Stripe ready</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{cleaner.user_email}</p>
            {cleaner.user_phone && (
              <p className="text-xs text-muted-foreground">{cleaner.user_phone}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-medium">{formatCurrency(cleaner.hourly_rate)}/hr</p>
            <p className="text-xs text-muted-foreground">{cleaner.years_experience}y experience</p>
            {cleaner.average_rating !== undefined && cleaner.average_rating !== null && (
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs">{cleaner.average_rating.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">({cleaner.total_jobs} jobs)</span>
              </div>
            )}
          </div>
        </div>

        {cleaner.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{cleaner.bio}</p>
        )}

        {cleaner.rejection_reason && (
          <div className="text-xs bg-destructive/5 border border-destructive/20 rounded px-3 py-2 mb-4 text-destructive">
            Rejection reason: {cleaner.rejection_reason}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Applied {formatDate(cleaner.created_at)}</p>
          <div className="flex gap-2">
            {cleaner.status === 'pending' && (
              <>
                <Button
                  size="sm"
                  onClick={onApprove}
                  disabled={loading}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onReject}
                  disabled={loading}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Reject
                </Button>
              </>
            )}
            {cleaner.status === 'approved' && (
              <Button
                size="sm"
                variant="outline"
                onClick={onToggleSuspend}
                disabled={loading}
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <PauseCircle className="h-3.5 w-3.5 mr-1" />
                Suspend
              </Button>
            )}
            {cleaner.status === 'suspended' && (
              <Button
                size="sm"
                variant="outline"
                onClick={onToggleSuspend}
                disabled={loading}
              >
                <PlayCircle className="h-3.5 w-3.5 mr-1" />
                Reinstate
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function AdminCleanersPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [cleaners, setCleaners] = useState<Record<Tab, AdminCleaner[]>>({
    pending: [], approved: [], suspended: [], rejected: [],
  })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Reject dialog
  const [rejectTarget, setRejectTarget] = useState<AdminCleaner | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const loadTab = useCallback(async (status: Tab) => {
    setLoading(true)
    try {
      const res = await adminApi.listCleaners({ status })
      setCleaners(prev => ({ ...prev, [status]: res.data?.items ?? [] }))
    } catch {
      toast.error(`Failed to load ${status} cleaners.`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTab(tab) }, [tab, loadTab])

  async function approve(cleaner: AdminCleaner) {
    setActionLoading(cleaner.id)
    try {
      await adminApi.approveCleaner(cleaner.id, 'approve')
      toast.success(`${cleaner.user_name} approved.`)
      loadTab('pending')
      loadTab('approved')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to approve.')
    } finally {
      setActionLoading(null)
    }
  }

  async function submitReject() {
    if (!rejectTarget) return
    if (!rejectReason.trim()) { toast.error('Please provide a rejection reason.'); return }
    setRejecting(true)
    try {
      await adminApi.approveCleaner(rejectTarget.id, 'reject', rejectReason)
      toast.success(`${rejectTarget.user_name} rejected.`)
      setRejectTarget(null)
      setRejectReason('')
      loadTab('pending')
      loadTab('rejected')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to reject.')
    } finally {
      setRejecting(false)
    }
  }

  async function toggleSuspend(cleaner: AdminCleaner) {
    setActionLoading(cleaner.id)
    try {
      const res = await adminApi.suspendCleaner(cleaner.id)
      const newStatus = res.data?.status
      toast.success(
        newStatus === 'suspended'
          ? `${cleaner.user_name} suspended.`
          : `${cleaner.user_name} reinstated.`,
      )
      loadTab('approved')
      loadTab('suspended')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Cleaners</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage cleaner applications and accounts</p>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as Tab)}>
        <TabsList>
          {TAB_STATUS.map(s => (
            <TabsTrigger key={s} value={s} className="capitalize gap-1.5">
              {s}
              {cleaners[s].length > 0 && (
                <span className={`h-4 w-4 rounded-full text-[10px] flex items-center justify-center font-medium ${
                  s === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  s === 'suspended' ? 'bg-red-100 text-red-800' : 'bg-muted text-muted-foreground'
                }`}>
                  {cleaners[s].length}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_STATUS.map(s => (
          <TabsContent key={s} value={s} className="mt-4">
            {loading && tab === s ? (
              <LoadingSpinner />
            ) : cleaners[s].length === 0 ? (
              <EmptyState
                title={`No ${s} cleaners`}
                description={
                  s === 'pending' ? 'New cleaner applications will appear here.' :
                  s === 'approved' ? 'No approved cleaners yet.' :
                  s === 'suspended' ? 'No suspended cleaners.' :
                  'No rejected applications.'
                }
              />
            ) : (
              <div className="space-y-3">
                {cleaners[s].map(c => (
                  <CleanerCard
                    key={c.id}
                    cleaner={c}
                    loading={actionLoading === c.id}
                    onApprove={() => approve(c)}
                    onReject={() => setRejectTarget(c)}
                    onToggleSuspend={() => toggleSuspend(c)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onClose={() => { setRejectTarget(null); setRejectReason('') }}>
        <DialogTitle>Reject — {rejectTarget?.user_name}</DialogTitle>
        <div className="space-y-3 mt-2">
          <p className="text-sm text-muted-foreground">
            The cleaner will be notified with this reason. Be specific and professional.
          </p>
          <div>
            <Label>Rejection reason</Label>
            <Textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. We could not verify your identity documents. Please reapply with a clear photo ID."
              className="mt-1"
              rows={3}
            />
          </div>
          <Button
            variant="destructive"
            className="w-full"
            onClick={submitReject}
            loading={rejecting}
          >
            Confirm rejection
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
