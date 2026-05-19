'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Briefcase,
  Car,
  CheckCircle2,
  FileText,
  Mail,
  PauseCircle,
  Phone,
  PlayCircle,
  Shield,
  Star,
  Truck,
  UserRound,
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
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { AdminCleaner } from '@/types'
import {
  CLEANER_REJECTION_REASON_OPTIONS,
  cleanerLifecycleLabel,
  deriveCleanerLifecycleStatus,
  getCleanerRejectionReasonLabel,
} from '@/lib/cleaner-status'
import { toast } from 'sonner'

type Tab = 'pending_approval' | 'approved' | 'live' | 'suspended' | 'rejected'

const TAB_STATUS: Tab[] = ['pending_approval', 'approved', 'live', 'suspended', 'rejected']

const STATUS_BADGE: Record<Tab, { variant: any; label: string }> = {
  pending_approval: { variant: 'warning', label: 'Pending approval' },
  approved: { variant: 'secondary', label: 'Approved' },
  live: { variant: 'success', label: 'Live' },
  suspended: { variant: 'destructive', label: 'Suspended' },
  rejected: { variant: 'outline', label: 'Rejected' },
}

const TRANSPORT_LABELS: Record<string, string> = {
  own_car: 'Own car',
  bus_walk: 'Bus / walk',
  requires_pickup: 'Requires pick-up',
}

const SUPPLIES_LABELS: Record<string, string> = {
  own_supplies: 'Own supplies',
  client_supplies: 'Client supplies',
}

const ID_TYPE_LABELS: Record<string, string> = {
  passport: 'Passport',
  national_id: 'National ID',
  drivers_licence: "Driver's Licence",
}

function yesNoBadge(value?: boolean) {
  return value ? <Badge variant="success">Yes</Badge> : <Badge variant="outline">No</Badge>
}

function cleanerLifecycle(cleaner: AdminCleaner): Tab {
  const lifecycle = cleaner.lifecycle_status as Tab | undefined
  if (lifecycle && TAB_STATUS.includes(lifecycle)) return lifecycle
  return deriveCleanerLifecycleStatus({
    status: cleaner.status,
    stripeOnboardingComplete: cleaner.stripe_onboarding_complete,
    profileComplete: cleaner.profile_complete,
  }) as Tab
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
  const lifecycle = cleanerLifecycle(cleaner)
  const sb = STATUS_BADGE[lifecycle]
  const fallbackName = cleaner.user_name?.trim() || cleaner.user_email?.split('@')[0] || 'Cleaner'

  return (
    <Card className="rounded-2xl border-slate-200">
      <CardContent className="px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex items-start gap-3">
            <UserAvatar
              name={fallbackName}
              imageUrl={cleaner.profile_image_url}
              className="h-12 w-12 shrink-0 border border-slate-200"
              textClassName="text-sm font-semibold"
              fallbackClassName="bg-primary/10 text-primary"
              fallback="C"
            />
            <div className="min-w-0">
              <div className="mb-0.5 flex flex-wrap items-center gap-2">
                <span className="truncate text-lg font-semibold">{fallbackName}</span>
                <Badge variant={sb.variant}>{sb.label}</Badge>
                {cleaner.identity_verified && (
                  <Badge variant="outline" className="text-[10px] py-0">ID verified</Badge>
                )}
                {cleaner.trial_period_flag !== undefined && (
                  <Badge variant={cleaner.trial_period_flag ? 'warning' : 'outline'} className="text-[10px] py-0">
                    Trial {cleaner.trial_period_flag ? 'On' : 'Off'}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {cleaner.user_email && (
                  <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{cleaner.user_email}</span>
                )}
                {cleaner.user_phone && (
                  <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{cleaner.user_phone}</span>
                )}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-medium">{formatCurrency(cleaner.hourly_rate)}/hr</p>
            <p className="text-xs text-muted-foreground">
              {cleaner.years_experience > 0 ? `${cleaner.years_experience}y experience` : 'Experience not set'}
            </p>
            {cleaner.average_rating !== undefined && cleaner.average_rating !== null && (
              <div className="mt-0.5 flex items-center justify-end gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs">{cleaner.average_rating.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">({cleaner.total_jobs} jobs)</span>
              </div>
            )}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-start gap-2">
            <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Transport</p>
              <p className="font-medium">{TRANSPORT_LABELS[cleaner.transport_mode || ''] ?? cleaner.transport_mode ?? 'Not set'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Supplies</p>
              <p className="font-medium">{SUPPLIES_LABELS[cleaner.cleaning_supplies || ''] ?? cleaner.cleaning_supplies ?? 'Not set'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Cleaning standards</p>
              <div className="mt-0.5">{yesNoBadge(cleaner.cleaning_standards_accepted)}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Quiz passed</p>
              <div className="mt-0.5">{yesNoBadge(cleaner.quiz_passed)}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Car className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Stripe setup</p>
              <div className="mt-0.5">{yesNoBadge(cleaner.stripe_onboarding_complete)}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Lifecycle</p>
              <p className="font-medium">{cleanerLifecycleLabel(lifecycle)}</p>
            </div>
          </div>
        </div>

        {cleaner.id_type && (
          <div className="mb-4 flex items-start gap-2 text-sm">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">KYC document</p>
              <p className="font-medium">{ID_TYPE_LABELS[cleaner.id_type] ?? cleaner.id_type}</p>
              {cleaner.id_file_name && (
                cleaner.id_file_url ? (
                  <a
                    href={cleaner.id_file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    {cleaner.id_file_name}
                  </a>
                ) : (
                  <p className="max-w-[220px] truncate text-xs text-muted-foreground">{cleaner.id_file_name}</p>
                )
              )}
            </div>
          </div>
        )}

        {cleaner.rejection_reason && (
          <div className="mb-4 rounded border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <span className="font-semibold">Rejection reason:</span> {cleaner.rejection_reason}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Submitted {formatDate(cleaner.created_at)}</p>
          <div className="flex flex-wrap gap-2">
            {lifecycle === 'pending_approval' && (
              <>
                <Button size="sm" onClick={onApprove} disabled={loading}>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={onReject} disabled={loading}>
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  Reject
                </Button>
              </>
            )}
            {(lifecycle === 'approved' || lifecycle === 'live') && (
              <Button
                size="sm"
                variant="outline"
                onClick={onToggleSuspend}
                disabled={loading}
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <PauseCircle className="mr-1 h-3.5 w-3.5" />
                Suspend
              </Button>
            )}
            {lifecycle === 'suspended' && (
              <Button size="sm" variant="outline" onClick={onToggleSuspend} disabled={loading}>
                <PlayCircle className="mr-1 h-3.5 w-3.5" />
                Reinstate
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminCleanersPage() {
  const [tab, setTab] = useState<Tab>('pending_approval')
  const [cleaners, setCleaners] = useState<Record<Tab, AdminCleaner[]>>({
    pending_approval: [],
    approved: [],
    live: [],
    suspended: [],
    rejected: [],
  })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [rejectTarget, setRejectTarget] = useState<AdminCleaner | null>(null)
  const [rejectReasonCode, setRejectReasonCode] = useState<string>(CLEANER_REJECTION_REASON_OPTIONS[0].code)
  const [rejectCustomMessage, setRejectCustomMessage] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const loadTab = useCallback(async (status: Tab) => {
    setLoading(true)
    try {
      const res = await adminApi.listCleaners({ status })
      setCleaners((prev) => ({ ...prev, [status]: res.data?.items ?? [] }))
      resetLoadError(`admin-cleaners-${status}`)
    } catch {
      reportLoadError(`admin-cleaners-${status}`, `Failed to load ${status.replace('_', ' ')} cleaners.`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTab(tab)
  }, [tab, loadTab])

  async function refreshStatusSets(statuses: Tab[]) {
    await Promise.all(statuses.map((status) => loadTab(status)))
  }

  async function approve(cleaner: AdminCleaner) {
    setActionLoading(cleaner.id)
    try {
      await adminApi.approveCleaner(cleaner.id, 'approve')
      toast.success(`${cleaner.user_name || 'Cleaner'} approved.`)
      await refreshStatusSets(['pending_approval', 'approved', 'live'])
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to approve.')
    } finally {
      setActionLoading(null)
    }
  }

  async function submitReject() {
    if (!rejectTarget) return
    const customMessage = rejectCustomMessage.trim()
    setRejecting(true)
    try {
      await adminApi.approveCleaner(rejectTarget.id, 'reject', customMessage || getCleanerRejectionReasonLabel(rejectReasonCode as any), {
        rejection_reason_code: rejectReasonCode,
        rejection_custom_message: customMessage || undefined,
      })
      toast.success(`${rejectTarget.user_name || 'Cleaner'} rejected.`)
      setRejectTarget(null)
      setRejectReasonCode(CLEANER_REJECTION_REASON_OPTIONS[0].code)
      setRejectCustomMessage('')
      await refreshStatusSets(['pending_approval', 'rejected'])
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
      const newLifecycle = deriveCleanerLifecycleStatus({
        status: res.data?.status,
        stripeOnboardingComplete: cleaner.stripe_onboarding_complete,
        profileComplete: cleaner.profile_complete,
      })
      toast.success(
        newLifecycle === 'suspended'
          ? `${cleaner.user_name || 'Cleaner'} suspended.`
          : `${cleaner.user_name || 'Cleaner'} reinstated.`,
      )
      await refreshStatusSets(['approved', 'live', 'suspended'])
    } catch (err: any) {
      toast.error(err.message ?? 'Failed.')
    } finally {
      setActionLoading(null)
    }
  }

  const tabCount = useMemo(() => cleaners[tab].length, [cleaners, tab])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm text-muted-foreground">Cleaner lifecycle queue</p>
        <p className="text-lg font-semibold text-slate-900">{tabCount} records in {tab.replace('_', ' ')}</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="space-y-0">
        <TabsList className="scrollbar-hide grid h-auto w-full auto-cols-[minmax(140px,1fr)] grid-flow-col gap-1 overflow-x-auto whitespace-nowrap rounded-xl bg-slate-100 p-1 [-webkit-overflow-scrolling:touch] lg:grid-flow-row lg:grid-cols-5 lg:auto-cols-auto">
          {TAB_STATUS.map((s) => (
            <TabsTrigger key={s} value={s} className="h-9 rounded-lg gap-1.5 text-[12px] sm:text-sm">
              {cleanerLifecycleLabel(s)}
              {cleaners[s].length > 0 && (
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-medium ${
                    s === 'pending_approval'
                      ? 'bg-yellow-100 text-yellow-800'
                      : s === 'suspended'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {cleaners[s].length}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_STATUS.map((s) => (
          <TabsContent key={s} value={s} className="mt-4">
            {loading && tab === s ? (
              <LoadingSpinner />
            ) : cleaners[s].length === 0 ? (
              <EmptyState
                title={`No ${cleanerLifecycleLabel(s).toLowerCase()} cleaners`}
                description={
                  s === 'pending_approval'
                    ? 'New cleaner applications will appear here.'
                    : s === 'approved'
                      ? 'No approved (Stripe pending) cleaners.'
                      : s === 'live'
                        ? 'No live cleaners currently.'
                        : s === 'suspended'
                          ? 'No suspended cleaners.'
                          : 'No rejected applications.'
                }
              />
            ) : (
              <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 sm:p-5">
                {cleaners[s].map((c) => (
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

      <Dialog
        open={!!rejectTarget}
        onClose={() => {
          setRejectTarget(null)
          setRejectReasonCode(CLEANER_REJECTION_REASON_OPTIONS[0].code)
          setRejectCustomMessage('')
        }}
      >
        <DialogTitle>Reject — {rejectTarget?.user_name}</DialogTitle>
        <div className="mt-2 space-y-3">
          <p className="text-sm text-muted-foreground">
            Select the reason and add optional details. The cleaner will receive an in-app correction notice.
          </p>

          <div>
            <Label>Predefined reason</Label>
            <select
              value={rejectReasonCode}
              onChange={(e) => setRejectReasonCode(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {CLEANER_REJECTION_REASON_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Optional custom message</Label>
            <Textarea
              value={rejectCustomMessage}
              onChange={(e) => setRejectCustomMessage(e.target.value)}
              placeholder="Add specific fixes required before resubmission."
              className="mt-1"
              rows={3}
            />
          </div>

          <Button variant="destructive" className="w-full" onClick={submitReject} loading={rejecting}>
            Confirm rejection
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
