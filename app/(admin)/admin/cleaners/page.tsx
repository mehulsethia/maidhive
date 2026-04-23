'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Briefcase,
  Car,
  CheckCircle2,
  FileText,
  Mail,
  PauseCircle,
  Phone,
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
import { UserAvatar } from '@/components/ui/user-avatar'
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

const TRANSPORT_LABELS: Record<string, string> = {
  own_car: 'Own Car',
  bus_walk: 'Bus / Walk',
  requires_pickup: 'Requires Pick-up',
}

const ID_TYPE_LABELS: Record<string, string> = {
  passport: 'Passport',
  national_id: 'National ID',
  drivers_licence: "Driver's Licence",
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
  const fallbackUser = (cleaner as any).user as { name?: string; email?: string; phone?: string } | undefined
  const cleanerName = cleaner.user_name || fallbackUser?.name || 'Cleaner'
  const cleanerEmail = cleaner.user_email || fallbackUser?.email || ''
  const cleanerPhone = cleaner.user_phone || fallbackUser?.phone
  const sb = STATUS_BADGE[cleaner.status]
  return (
    <Card className="rounded-2xl border-slate-200">
      <CardContent className="px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-6">
        {/* Header: avatar, name, badges, rate */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <UserAvatar
              name={cleanerName}
              imageUrl={cleaner.profile_image_url}
              className="h-12 w-12 shrink-0 border border-slate-200"
              textClassName="text-sm font-semibold"
              fallbackClassName="bg-primary/10 text-primary"
              fallback="C"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="font-semibold text-lg">{cleanerName}</span>
                <Badge variant={sb.variant}>{sb.label}</Badge>
                {cleaner.identity_verified && (
                  <Badge variant="outline" className="text-[10px] py-0">ID verified</Badge>
                )}
                {cleaner.stripe_onboarding_complete && (
                  <Badge variant="outline" className="text-[10px] py-0">Stripe ready</Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {cleanerEmail && (
                  <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{cleanerEmail}</span>
                )}
                {cleanerPhone && (
                  <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{cleanerPhone}</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-medium">{formatCurrency(cleaner.hourly_rate)}/hr</p>
            <p className="text-xs text-muted-foreground">
              {cleaner.years_experience > 0 ? `${cleaner.years_experience}y experience` : 'Experience not set'}
            </p>
            {cleaner.average_rating !== undefined && cleaner.average_rating !== null && (
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs">{cleaner.average_rating.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">({cleaner.total_jobs} jobs)</span>
              </div>
            )}
          </div>
        </div>

        {/* Metadata grid */}
        <div className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {cleaner.transport_mode && (
            <div className="flex items-start gap-2">
              <Car className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Transport</p>
                <p className="font-medium">{TRANSPORT_LABELS[cleaner.transport_mode] ?? cleaner.transport_mode}</p>
              </div>
            </div>
          )}
          {cleaner.id_type && (
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">KYC Document</p>
                <p className="font-medium">{ID_TYPE_LABELS[cleaner.id_type] ?? cleaner.id_type}</p>
                {cleaner.id_file_name && (
                  <p className="text-xs text-muted-foreground truncate max-w-[160px]">{cleaner.id_file_name}</p>
                )}
              </div>
            </div>
          )}
          {cleaner.skills && cleaner.skills.length > 0 && (
            <div className="flex items-start gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Skills</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {cleaner.skills.map(s => (
                    <span key={s} className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {cleaner.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{cleaner.bio}</p>
        )}

        {cleaner.rejection_reason && (
          <div className="text-xs bg-destructive/5 border border-destructive/20 rounded px-3 py-2 mb-4 text-destructive">
            <span className="font-semibold">Rejection reason:</span> {cleaner.rejection_reason}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Applied {formatDate(cleaner.created_at)}</p>
          <div className="flex flex-wrap gap-2">
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
      toast.success(`${cleaner.user_name || 'Cleaner'} approved.`)
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
      toast.success(`${rejectTarget.user_name || 'Cleaner'} rejected.`)
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
          ? `${cleaner.user_name || 'Cleaner'} suspended.`
          : `${cleaner.user_name || 'Cleaner'} reinstated.`,
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
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={v => setTab(v as Tab)} className="space-y-0">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-4">
          {TAB_STATUS.map(s => (
            <TabsTrigger key={s} value={s} className="h-9 rounded-lg capitalize gap-1.5">
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
              <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 sm:p-5">
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
