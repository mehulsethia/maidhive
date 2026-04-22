'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Star, ChartNoAxesCombined, CalendarDays, Wallet } from 'lucide-react'
import { bookingsApi, cleanersApi, paymentsApi, reviewsApi, usersApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ProfilePageSkeleton } from '@/components/page-skeletons'
import { AvatarUpload } from '@/components/avatar-upload'
import { PhoneInput } from '@/components/phone-input'
import { ScheduleEditor } from '@/components/schedule-editor'
import { formatCurrency } from '@/lib/utils'
import type { BookingRead, ReviewRead } from '@/types'
import { toast } from 'sonner'

type TabKey = 'overview' | 'availability' | 'reviews' | 'payments'

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

const SKILLS = ['Ironing', 'Windows', 'Deep Cleaning', 'Move In/Out']

function CleanerProfilePageContent() {
  const params = useSearchParams()
  const initialTab = (params.get('tab') as TabKey) || 'overview'
  const [tab, setTab] = useState<TabKey>(
    ['overview', 'availability', 'reviews', 'payments'].includes(initialTab) ? initialTab : 'overview',
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [cleanerId, setCleanerId] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [yearsExperience, setYearsExperience] = useState('0')
  const [hourlyRate, setHourlyRate] = useState('15')
  const [transportMode, setTransportMode] = useState('')
  const [homeAddress, setHomeAddress] = useState('')
  const [bio, setBio] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)

  const [completionPct, setCompletionPct] = useState<number>(100)
  const [cleanerStatus, setCleanerStatus] = useState<string>('pending')
  const [rejectionReason, setRejectionReason] = useState<string>('')
  const [profileComplete, setProfileComplete] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [reviews, setReviews] = useState<ReviewRead[]>([])
  const [stripe, setStripe] = useState<{
    connected: boolean
    onboarded: boolean
    charges_enabled: boolean
    payouts_enabled: boolean
    details_submitted: boolean
  }>({
    connected: false,
    onboarded: false,
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
  })

  async function loadAll() {
    setLoading(true)
    try {
      const [meRes, bookingRes, stripeRes] = await Promise.all([
        cleanersApi.me(),
        bookingsApi.my(),
        paymentsApi.getConnectStatus(),
      ])

      const c = (meRes.data?.cleaner ?? {}) as any
      const onboarding = meRes.data?.onboarding
      const user = c.user ?? {}

      setCompletionPct(onboarding?.completion_pct ?? 0)
      setCleanerStatus(c.status ?? 'pending')
      setRejectionReason(c.rejection_reason ?? '')
      setProfileComplete(c.profile_complete ?? false)

      setCleanerId(c.id ?? '')
      setFullName(user.name ?? '')
      setEmail(user.email ?? '')
      setPhone(user.phone ?? '')
      setYearsExperience(String(c.years_experience ?? c.yearsExperience ?? 0))
      setHourlyRate(String(c.hourly_rate ?? c.hourlyRate ?? 15))
      setTransportMode(c.transport_mode ?? c.transportMode ?? '')
      setHomeAddress(c.transport_pickup_location ?? c.transportPickupLocation ?? '')
      setBio(c.bio ?? '')
      setSkills(c.skills ?? [])
      setProfileImageUrl(c.profile_image_url ?? c.profileImageUrl ?? null)

      const names = String(user.name ?? '').trim().split(' ').filter(Boolean)
      setFirstName(names[0] ?? '')
      setLastName(names.slice(1).join(' '))

      setBookings(bookingRes.data?.items ?? [])
      setStripe({
        connected: Boolean(stripeRes.data?.connected),
        onboarded: Boolean(stripeRes.data?.onboarded),
        charges_enabled: Boolean(stripeRes.data?.charges_enabled),
        payouts_enabled: Boolean(stripeRes.data?.payouts_enabled),
        details_submitted: Boolean(stripeRes.data?.details_submitted),
      })

      if (c.id) {
        const reviewsRes = await reviewsApi.getForCleanerPaged(c.id)
        setReviews(reviewsRes.data?.reviews ?? [])
      } else {
        setReviews([])
      }
    } catch {
      toast.error('Failed to load profile.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const stats = useMemo(() => {
    const totalJobs = bookings.length
    const completed = bookings.filter((b) => b.status === 'completed').length
    const completionRate = totalJobs > 0 ? Math.round((completed / totalJobs) * 100) : 0
    const totalEarnings = bookings
      .filter((b) => b.status === 'completed')
      .reduce((sum, b) => sum + b.cleaner_payout, 0)
    return {
      totalJobs,
      completionRate,
      totalEarnings,
    }
  }, [bookings])

  const avgReview = useMemo(() => {
    if (reviews.length === 0) return 0
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
  }, [reviews])

  const paymentHistory = useMemo(() => {
    return bookings
      .filter((b) => b.payment || ['completed', 'disputed', 'confirmed', 'in_progress'].includes(b.status))
      .sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())
  }, [bookings])

  function toggleSkill(skill: string) {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]))
  }

  async function saveOverview() {
    if (!firstName.trim()) return toast.error('First name is required.')
    if (!lastName.trim()) return toast.error('Last name is required.')
    if (!phone.trim()) return toast.error('Phone is required.')
    if (Number(hourlyRate) < 15) return toast.error('Hourly rate must be at least 15.')
    if (!bio.trim()) return toast.error('Professional bio is required.')
    if (skills.length === 0) return toast.error('Select at least one skill.')
    if (!transportMode) return toast.error('Mode of transport is required.')

    setSaving(true)
    try {
      await usersApi.updateMe({ name: `${firstName.trim()} ${lastName.trim()}`, phone })
      await cleanersApi.updateMyOnboarding({
        years_experience: Number(yearsExperience),
        hourly_rate: Number(hourlyRate),
        transport_mode: transportMode,
        transport_pickup_location: homeAddress || null,
        bio,
        skills,
      })
      toast.success('Profile updated.')
      await loadAll()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }


  async function submitForApproval() {
    setSubmitting(true)
    try {
      await cleanersApi.submitForApproval()
      toast.success('Profile submitted for approval!')
      await loadAll()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit profile.')
    } finally {
      setSubmitting(false)
    }
  }

  async function connectStripe() {
    if (saving || submitting) return
    try {
      const res = stripe.connected
        ? await paymentsApi.createConnectDashboardLink()
        : await paymentsApi.createConnectOnboardLink()
      const url = res.data?.url
      if (!url) throw new Error('Could not generate Stripe link.')
      window.location.href = url
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to open Stripe.')
    }
  }

  if (loading) return <ProfilePageSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-end gap-3">
        <Button variant="outline" onClick={saveOverview} disabled={tab !== 'overview'} loading={saving && tab === 'overview'}>
          Update profile
        </Button>
      </div>

      {cleanerStatus === 'rejected' && (
        <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-red-900">Your profile was not approved.</p>
              {rejectionReason && (
                <p className="text-xs text-red-700 mt-1">Reason: {rejectionReason}</p>
              )}
              <p className="text-xs text-red-600 mt-1">Please update your profile and resubmit for review.</p>
            </div>
            <Button size="sm" onClick={submitForApproval} loading={submitting} className="shrink-0">
              Resubmit for approval
            </Button>
          </div>
        </div>
      )}

      {cleanerStatus === 'pending' && completionPct === 100 && !profileComplete && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-900">Your profile is ready!</p>
              <p className="text-xs text-blue-700">Submit your profile for admin review to start receiving bookings.</p>
            </div>
            <Button size="sm" onClick={submitForApproval} loading={submitting} className="shrink-0">
              Submit for approval
            </Button>
          </div>
        </div>
      )}

      {cleanerStatus === 'pending' && profileComplete && (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div>
              <p className="text-sm font-semibold text-amber-900">Profile submitted — awaiting admin approval.</p>
              <p className="text-xs text-amber-700">You'll be notified once your profile is reviewed.</p>
            </div>
          </div>
        </div>
      )}

      {cleanerStatus !== 'rejected' && completionPct < 100 && (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">Profile completion: {completionPct}%</p>
              <p className="text-xs text-amber-700">Complete all steps so your profile can be submitted for review.</p>
            </div>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-amber-200 shrink-0">
              <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${completionPct}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card className="border-slate-200">
            <CardContent className="p-5 !pt-5 text-center">
              <div className="mx-auto mb-3">
                <AvatarUpload
                  currentUrl={profileImageUrl}
                  fallbackInitial={(fullName || 'M').trim().charAt(0)}
                  onUploaded={(url) => setProfileImageUrl(url)}
                />
              </div>
              <p className="text-2xl font-bold text-slate-900">{fullName || 'Cleaner'}</p>
              <p className="text-sm text-slate-500">{email || 'No email found'}</p>
              <div className="mt-2 flex items-center justify-center gap-1 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < Math.round(avgReview) ? 'fill-current' : ''}`} />
                ))}
                <span className="ml-1 text-sm font-medium text-slate-600">
                  {avgReview ? avgReview.toFixed(1) : '0.0'} ({reviews.length} reviews)
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="space-y-2 p-5 !pt-5 text-sm">
              <p className="font-semibold text-slate-900">Performance Stats</p>
              <div className="flex items-center justify-between text-slate-600"><span>Total Jobs</span><strong>{stats.totalJobs}</strong></div>
              <div className="flex items-center justify-between text-slate-600"><span>Completion Rate</span><strong>{stats.completionRate}%</strong></div>
              <div className="flex items-center justify-between text-slate-600"><span>Total Earnings</span><strong className="text-emerald-700">{formatCurrency(stats.totalEarnings)}</strong></div>
              <div className="flex items-center justify-between text-slate-600"><span>Response Time</span><strong>&lt; 2 hours</strong></div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="space-y-2 p-5 !pt-5">
              <p className="font-semibold text-slate-900">Quick Actions</p>
              <button onClick={() => setTab('overview')} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"><ChartNoAxesCombined className="h-4 w-4 text-primary" />View Overview</button>
              <button onClick={() => setTab('availability')} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"><CalendarDays className="h-4 w-4 text-primary" />Update Availability</button>
              <button onClick={() => setTab('reviews')} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"><Star className="h-4 w-4 text-primary" />Manage Reviews</button>
              <button onClick={() => setTab('payments')} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"><Wallet className="h-4 w-4 text-primary" />Payout Settings</button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200">
          <CardContent className="p-4 md:p-6">
            <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
              {([
                ['overview', 'Overview'],
                ['availability', 'Availability'],
                ['reviews', 'Reviews'],
                ['payments', 'Payments'],
              ] as Array<[TabKey, string]>).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div><Label>First Name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" /></div>
                  <div><Label>Last Name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" /></div>
                  <div><Label>Phone Number</Label><PhoneInput value={phone} onChange={setPhone} className="mt-1" /></div>
                  <div><Label>Home Address</Label><Input value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} className="mt-1" /></div>
                  <div><Label>Years of Experience</Label><Input type="number" min={0} value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} className="mt-1" /></div>
                  <div><Label>Hourly Rate</Label><Input type="number" min={15} value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="mt-1" /></div>
                </div>

                <div>
                  <Label>Mode of Transport</Label>
                  <Select value={transportMode} onChange={(e) => setTransportMode(e.target.value)} className="mt-1">
                    <option value="">Choose an option...</option>
                    <option value="own_car">Own Car</option>
                    <option value="bus_walk">Bus / Walk</option>
                    <option value="requires_pickup">Requires Pick-up</option>
                  </Select>
                </div>

                <div>
                  <Label>Professional Bio</Label>
                  <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={5} className="mt-1" />
                </div>

                <div>
                  <Label>Skills</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SKILLS.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={`rounded-md border px-3 py-1.5 text-sm ${
                          skills.includes(skill)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={saveOverview} loading={saving}>Save & Publish</Button>
                </div>
              </div>
            )}

            {tab === 'availability' && (
              <div className="-mx-4 -mb-4 sm:-mx-5 sm:-mb-5">
                <ScheduleEditor />
              </div>
            )}

            {tab === 'reviews' && (
              <div className="space-y-3">
                {reviews.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    No reviews yet. Completed bookings will generate reviews here.
                  </div>
                ) : (
                  reviews.map((r) => (
                    <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="font-semibold text-slate-900">Booking #{r.booking_id.slice(0, 8)}</p>
                        <div className="flex items-center gap-1 text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-4 w-4 ${i < r.rating ? 'fill-current' : ''}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString('en-IE', { timeZone: 'Europe/Nicosia' })}</p>
                      <p className="mt-2 text-sm text-slate-700">{r.comment || 'No written comment provided.'}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'payments' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-2xl font-semibold leading-none text-[#635BFF]">stripe</p>
                      <p className="mt-2 text-sm text-slate-500">Manage earnings and payouts securely with Stripe Connect.</p>
                    </div>
                    <Button onClick={connectStripe} variant="outline">{stripe.connected ? 'Manage Stripe' : 'Connect Stripe'}</Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="text-slate-500">Connected</p>
                    <p className={`font-semibold ${stripe.connected ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {stripe.connected ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="text-slate-500">Payouts Enabled</p>
                    <p className={`font-semibold ${stripe.payouts_enabled ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {stripe.payouts_enabled ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="text-slate-500">Charges Enabled</p>
                    <p className={`font-semibold ${stripe.charges_enabled ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {stripe.charges_enabled ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="text-slate-500">Details Submitted</p>
                    <p className={`font-semibold ${stripe.details_submitted ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {stripe.details_submitted ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>

                {!stripe.connected && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Connect Stripe to receive payouts for completed jobs.
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-base font-semibold text-slate-900">Payment History</p>
                  <p className="mt-1 text-xs text-slate-500">Completed and active booking payments</p>

                  {paymentHistory.length === 0 ? (
                    <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                      No payment records yet. Completed bookings and their payout/payment states will appear here.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {paymentHistory.map((b) => (
                        <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {(b.service_type ?? 'Service').replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(b.scheduled_start).toLocaleDateString('en-IE', {
                                weekday: 'short',
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                timeZone: 'Europe/Nicosia',
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-emerald-700">{formatCurrency(b.cleaner_payout)}</p>
                            <p className="text-xs text-slate-500">
                              Payment: {String(b.payment?.status ?? 'pending').replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-slate-500">
                              Booking: {String(b.status).replace(/_/g, ' ')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function CleanerProfilePage() {
  return (
    <Suspense fallback={<ProfilePageSkeleton />}>
      <CleanerProfilePageContent />
    </Suspense>
  )
}
