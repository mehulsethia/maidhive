'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  BookOpen,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react'
import { adminApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { LoadingSpinner } from '@/components/loading-spinner'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { AdminStats, BookingRead, AdminCleaner, AdminDispute } from '@/types'
import { toast } from 'sonner'

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
  sub,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  color: string
  href: string
  sub?: string
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <div className={`p-2 rounded-lg ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </CardContent>
      </Card>
    </Link>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [recentBookings, setRecentBookings] = useState<BookingRead[]>([])
  const [pendingCleaners, setPendingCleaners] = useState<AdminCleaner[]>([])
  const [openDisputes, setOpenDisputes] = useState<AdminDispute[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, bookingsRes, cleanersRes, disputesRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.listBookings({ page: 1 }),
        adminApi.listCleaners({ status: 'pending' }),
        adminApi.listDisputes(),
      ])
      setStats(statsRes.data ?? null)
      setRecentBookings(bookingsRes.data?.items?.slice(0, 6) ?? [])
      setPendingCleaners(cleanersRes.data?.items?.slice(0, 4) ?? [])
      setOpenDisputes(disputesRes.data?.filter(d => d.status === 'open').slice(0, 4) ?? [])
    } catch {
      toast.error('Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Platform health at a glance</p>
      </div>

      {/* ── KPI Grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="Total users"
          value={stats?.total_users ?? 0}
          icon={Users}
          color="bg-blue-50 text-blue-600"
          href="/admin/users"
          sub={`${stats?.total_clients ?? 0} clients · ${stats?.total_cleaners ?? 0} cleaners`}
        />
        <StatCard
          label="Total revenue"
          value={formatCurrency(stats?.total_revenue ?? 0)}
          icon={BadgeDollarSign}
          color="bg-green-50 text-green-600"
          href="/admin/bookings"
          sub="From completed bookings"
        />
        <StatCard
          label="Platform earnings"
          value={formatCurrency(stats?.platform_earnings ?? 0)}
          icon={TrendingUp}
          color="bg-emerald-50 text-emerald-600"
          href="/admin/bookings"
          sub="15% platform fee"
        />
        <StatCard
          label="Active bookings"
          value={stats?.active_bookings ?? 0}
          icon={BookOpen}
          color="bg-purple-50 text-purple-600"
          href="/admin/bookings"
          sub={`${stats?.completed_bookings ?? 0} completed total`}
        />
        <StatCard
          label="Pending approvals"
          value={stats?.pending_cleaners ?? 0}
          icon={Clock}
          color="bg-yellow-50 text-yellow-600"
          href="/admin/cleaners"
          sub={`${stats?.approved_cleaners ?? 0} approved · ${stats?.suspended_cleaners ?? 0} suspended`}
        />
        <StatCard
          label="Open disputes"
          value={stats?.open_disputes ?? 0}
          icon={AlertTriangle}
          color="bg-red-50 text-red-600"
          href="/admin/disputes"
          sub="Require attention"
        />
        <StatCard
          label="Approved cleaners"
          value={stats?.approved_cleaners ?? 0}
          icon={ShieldCheck}
          color="bg-teal-50 text-teal-600"
          href="/admin/cleaners"
        />
        <StatCard
          label="Completed jobs"
          value={stats?.completed_bookings ?? 0}
          icon={CheckCircle2}
          color="bg-slate-50 text-slate-600"
          href="/admin/bookings"
        />
      </div>

      {/* ── Bottom row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Recent bookings */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent bookings</CardTitle>
              <Link href="/admin/bookings">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No bookings yet.</p>
            ) : (
              <div className="divide-y">
                {recentBookings.map(b => (
                  <div key={b.id} className="flex items-center gap-3 px-6 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">#{b.id.slice(0, 8)}</span>
                        <BookingStatusBadge status={b.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {b.service_type.replace(/_/g, ' ')} · {formatDate(b.scheduled_start)}
                      </p>
                    </div>
                    <span className="text-sm font-medium shrink-0">{formatCurrency(b.total_amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          {/* Pending cleaner approvals */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Pending approvals</CardTitle>
                <Link href="/admin/cleaners">
                  <Button variant="ghost" size="sm" className="text-xs gap-1">
                    Review <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {pendingCleaners.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">All clear!</p>
              ) : (
                <div className="divide-y">
                  {pendingCleaners.map(c => (
                    <div key={c.id} className="px-4 py-2.5">
                      <p className="text-sm font-medium truncate">{c.user_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.user_email}</p>
                      <p className="text-xs text-muted-foreground">
                        €{c.hourly_rate}/hr · {c.years_experience}y exp
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Open disputes */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Open disputes</CardTitle>
                <Link href="/admin/disputes">
                  <Button variant="ghost" size="sm" className="text-xs gap-1">
                    Handle <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {openDisputes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No open disputes.</p>
              ) : (
                <div className="divide-y">
                  {openDisputes.map(d => (
                    <div key={d.id} className="px-4 py-2.5">
                      <p className="text-xs font-mono text-muted-foreground">
                        #{d.booking_id.slice(0, 8)}
                      </p>
                      <p className="text-sm line-clamp-1">{d.reason}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(d.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
