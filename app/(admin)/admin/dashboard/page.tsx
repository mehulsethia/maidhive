'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock,
  CreditCard,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react'
import { adminApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/user-avatar'
import { LoadingSpinner } from '@/components/loading-spinner'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { formatDate } from '@/lib/utils'
import { setupVisiblePolling } from '@/lib/visible-polling'
import type { AdminOpsQueues, AdminStats } from '@/types'

const CANCELLATION_SEVERITY_BADGE: Record<
  AdminOpsQueues['cancellations_no_shows']['items'][number]['severity'],
  'outline' | 'secondary' | 'warning' | 'destructive'
> = {
  low: 'outline',
  medium: 'secondary',
  high: 'warning',
  critical: 'destructive',
}

const CANCELLATION_SEVERITY_CARD_CLASS: Record<
  AdminOpsQueues['cancellations_no_shows']['items'][number]['severity'],
  string
> = {
  low: 'border-slate-200 bg-slate-50/60',
  medium: 'border-sky-200 bg-sky-50/70',
  high: 'border-amber-300 bg-amber-50/80',
  critical: 'border-red-300 bg-red-50/80',
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  href,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  href?: string
}) {
  const card = (
    <Card className="border-slate-200">
      <CardContent className="px-5 pb-5 pt-6">
        <div className="mb-3 flex items-start justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
  if (!href) return card
  return <Link href={href} className="block transition hover:-translate-y-0.5">{card}</Link>
}

function WidgetShell({
  title,
  count,
  href,
  children,
}: {
  title: string
  count: number
  href: string
  children: React.ReactNode
}) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Live queue · {count} items</p>
          </div>
          <Link href={href}>
            <Button size="sm" variant="ghost" className="gap-1 text-xs">
              Open <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  )
}

function yesNoBadge(value: boolean) {
  return value ? (
    <Badge variant="success" className="text-[10px]">Yes</Badge>
  ) : (
    <Badge variant="outline" className="text-[10px]">No</Badge>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [queues, setQueues] = useState<AdminOpsQueues | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, queuesRes] = await Promise.all([adminApi.getStats(), adminApi.getOpsQueues()])
      setStats(statsRes.data ?? null)
      setQueues(queuesRes.data ?? null)
      resetLoadError('admin-dashboard')
    } catch {
      reportLoadError('admin-dashboard', 'Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    return setupVisiblePolling(load, Number(process.env.NEXT_PUBLIC_ADMIN_DASHBOARD_LIVE_REFRESH_MS ?? 45000))
  }, [load])

  const generatedAtLabel = useMemo(() => {
    if (!queues?.generated_at) return null
    return formatDate(queues.generated_at)
  }, [queues?.generated_at])

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Admin Control Center</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">Operational Queues</h1>
          </div>
          {generatedAtLabel && <p className="text-xs text-muted-foreground">Updated {generatedAtLabel}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Pending booking requests"
          value={queues?.pending_booking_requests.count ?? 0}
          sub="Awaiting cleaner acceptance"
          icon={Clock}
          href="/admin/bookings?filter=pending"
        />
        <KpiCard
          label="Active bookings today"
          value={queues?.todays_jobs.count ?? 0}
          sub="Accepted, confirmed, in-progress"
          icon={CalendarDays}
          href="/admin/bookings?filter=confirmed"
        />
        <KpiCard
          label="Payment failures"
          value={queues?.payment_failures.count ?? 0}
          sub="Recent failed payment attempts"
          icon={CreditCard}
          href="/admin/bookings?filter=failed_payments"
        />
      </div>

      <section aria-labelledby="dispute-overview-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="dispute-overview-heading" className="text-base font-semibold text-slate-900">
              Active disputes
            </h2>
            <p className="text-xs text-muted-foreground">
              {queues?.active_disputes.count ?? stats?.open_disputes ?? 0} cases requiring action
            </p>
          </div>
          <Link href="/admin/disputes" className="text-xs font-medium text-primary hover:underline">
            View dispute queue
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            label="Open Disputes"
            value={queues?.active_disputes.breakdown.open ?? 0}
            sub="New cases not yet triaged"
            icon={AlertTriangle}
            href="/admin/disputes"
          />
          <KpiCard
            label="Awaiting Response"
            value={queues?.active_disputes.breakdown.awaiting_response ?? 0}
            sub="Waiting for the other party"
            icon={Clock}
            href="/admin/disputes"
          />
          <KpiCard
            label="Under Review"
            value={queues?.active_disputes.breakdown.under_review ?? 0}
            sub="Response received; decision pending"
            icon={AlertCircle}
            href="/admin/disputes"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WidgetShell
          title="Pending Cleaner Approvals"
          count={queues?.pending_cleaner_approvals.count ?? 0}
          href="/admin/cleaners"
        >
          {queues?.pending_cleaner_approvals.items.length ? (
            queues.pending_cleaner_approvals.items.map((cleaner) => (
              <div key={cleaner.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-start gap-3">
                  <UserAvatar
                    name={cleaner.full_name}
                    imageUrl={cleaner.profile_photo ?? undefined}
                    className="h-10 w-10"
                    textClassName="text-xs"
                    fallbackClassName="bg-primary/10 text-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{cleaner.full_name}</p>
                    <p className="text-xs text-muted-foreground">{cleaner.years_experience}y experience</p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <p>Transport: <span className="font-medium">{cleaner.transport_method || 'Not set'}</span></p>
                  <p>Supplies: <span className="font-medium">{cleaner.supplies_status || 'Not set'}</span></p>
                  <p className="flex items-center gap-1">Standards: {yesNoBadge(cleaner.cleaning_standards_completed)}</p>
                  <p className="flex items-center gap-1">Quiz passed: {yesNoBadge(cleaner.quiz_passed)}</p>
                  <p className="flex items-center gap-1">Trial flag: {yesNoBadge(cleaner.trial_period_flag)}</p>
                  <p>Submitted: <span className="font-medium">{formatDate(cleaner.submitted_at)}</span></p>
                </div>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No cleaners pending review.</p>
          )}
        </WidgetShell>

        <WidgetShell title="Active Disputes" count={queues?.active_disputes.count ?? 0} href="/admin/disputes">
          {queues?.active_disputes.items.length ? (
            queues.active_disputes.items.map((dispute) => (
              <div key={dispute.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-mono text-muted-foreground">#{dispute.booking_id.slice(0, 8)}</p>
                  <Badge variant={dispute.queue_stage === 'open' ? 'warning' : 'secondary'}>
                    {dispute.queue_stage === 'awaiting_response'
                      ? 'Awaiting response'
                      : dispute.queue_stage === 'under_review'
                        ? 'Under review'
                        : 'Open'}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-slate-800">{dispute.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">Raised {formatDate(dispute.created_at)}</p>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No active disputes.</p>
          )}
        </WidgetShell>

        <WidgetShell title="Pending booking requests" count={queues?.pending_booking_requests.count ?? 0} href="/admin/bookings?filter=pending">
          {queues?.pending_booking_requests.items.length ? (
            queues.pending_booking_requests.items.map((booking) => (
              <div key={booking.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{booking.city}</p>
                  <Badge variant="outline">{booking.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-600">{booking.client_name} → {booking.cleaner_name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(booking.scheduled_start)}</p>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No pending booking requests.</p>
          )}
        </WidgetShell>

        <WidgetShell title="Active bookings today" count={queues?.todays_jobs.count ?? 0} href="/admin/bookings?filter=confirmed">
          {queues?.todays_jobs.items.length ? (
            queues.todays_jobs.items.map((job) => (
              <div key={job.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{job.city}</p>
                  <Badge variant="outline">{job.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-600">{job.client_name} → {job.cleaner_name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(job.scheduled_start)}</p>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No jobs scheduled for today.</p>
          )}
        </WidgetShell>

        <WidgetShell
          title="Upcoming Jobs (Today / Tomorrow)"
          count={(queues?.upcoming_jobs.today_count ?? 0) + (queues?.upcoming_jobs.tomorrow_count ?? 0)}
          href="/admin/bookings?filter=failed_payments"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Today: {queues?.upcoming_jobs.today_count ?? 0}</Badge>
            <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Tomorrow: {queues?.upcoming_jobs.tomorrow_count ?? 0}</Badge>
          </div>
          {[...(queues?.upcoming_jobs.today_items ?? []).slice(0, 3), ...(queues?.upcoming_jobs.tomorrow_items ?? []).slice(0, 3)].length ? (
            <div className="space-y-2">
              {[...(queues?.upcoming_jobs.today_items ?? []).slice(0, 3), ...(queues?.upcoming_jobs.tomorrow_items ?? []).slice(0, 3)].map((job) => (
                <div key={job.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{job.city}</p>
                    <Badge variant="outline">{job.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{job.client_name} → {job.cleaner_name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(job.scheduled_start)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No upcoming jobs in the next 48h.</p>
          )}
        </WidgetShell>

        <WidgetShell
          title="Payment issues"
          count={queues?.payment_issues.count ?? 0}
          href="/admin/bookings"
        >
          {queues?.payment_issues.items.length ? (
            queues.payment_issues.items.map((issue) => (
              <div key={issue.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-mono text-muted-foreground">Booking #{issue.booking_id.slice(0, 8)}</p>
                  <Badge variant="warning">{issue.payment_status}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-800">Client: {issue.client_name}</p>
                <p className="text-xs text-muted-foreground">Re-authorize by {issue.failed_at ? formatDate(issue.failed_at) : 'soon'}</p>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No active payment issues.</p>
          )}
        </WidgetShell>

        <WidgetShell
          title="Payment failures"
          count={queues?.payment_failures.count ?? 0}
          href="/admin/bookings"
        >
          {queues?.payment_failures.items.length ? (
            queues.payment_failures.items.map((issue) => (
              <div key={issue.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-mono text-muted-foreground">Booking #{issue.booking_id.slice(0, 8)}</p>
                  <Badge variant="destructive">{issue.payment_status}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-800">Client: {issue.client_name}</p>
                <p className="text-xs text-muted-foreground">Failed {issue.failed_at ? formatDate(issue.failed_at) : 'recently'}</p>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No recent payment failures.</p>
          )}
        </WidgetShell>

        <WidgetShell
          title="Cancellations / No-shows"
          count={queues?.cancellations_no_shows.count ?? 0}
          href="/admin/bookings"
        >
          {queues?.cancellations_no_shows.items.length ? (
            queues.cancellations_no_shows.items.map((incident) => (
              <div
                key={incident.id}
                className={`rounded-xl border p-3 ${CANCELLATION_SEVERITY_CARD_CLASS[incident.severity]}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={CANCELLATION_SEVERITY_BADGE[incident.severity]}>
                    {incident.label}
                  </Badge>
                  <p className="text-xs font-mono text-muted-foreground">#{incident.booking_id.slice(0, 8)}</p>
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-slate-800">{incident.reason}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatDate(incident.occurred_at)}</span>
                  {incident.lead_time_hours !== null && incident.lead_time_hours !== undefined && (
                    <span>{Math.max(incident.lead_time_hours, 0).toFixed(1)}h before start</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No recent cancellations or no-shows.</p>
          )}
        </WidgetShell>

        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cleaner Lifecycle Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-slate-700"><AlertCircle className="h-4 w-4 text-amber-500" />Pending approval</span>
              <span className="font-semibold">{stats?.pending_cleaners ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-slate-700"><ShieldCheck className="h-4 w-4 text-blue-600" />Approved (Stripe pending)</span>
              <span className="font-semibold">{Math.max((stats?.approved_cleaners ?? 0) - (stats?.live_cleaners ?? 0), 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-slate-700"><UserRound className="h-4 w-4 text-emerald-600" />Live</span>
              <span className="font-semibold">{stats?.live_cleaners ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-slate-700"><XCircle className="h-4 w-4 text-red-600" />Rejected</span>
              <span className="font-semibold">{stats?.rejected_cleaners ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-slate-700"><XCircle className="h-4 w-4 text-rose-700" />Suspended</span>
              <span className="font-semibold">{stats?.suspended_cleaners ?? 0}</span>
            </div>
            <Link href="/admin/cleaners" className="inline-flex">
              <Button className="mt-2 w-full" variant="outline">Open Cleaner Management</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
