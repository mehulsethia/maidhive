'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Star, ChartNoAxesCombined, CalendarDays, Wallet } from 'lucide-react'
import { bookingsApi, cleanersApi, googleCalendarApi, paymentsApi, phoneVerificationApi, reviewsApi, usersApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ProfilePageSkeleton } from '@/components/page-skeletons'
import { AvatarUpload } from '@/components/avatar-upload'
import { PhoneInput } from '@/components/phone-input'
import { ScheduleEditor } from '@/components/schedule-editor'
import { getAccessToken } from '@/lib/auth-cache'
import { toApiV1Url } from '@/lib/api-base'
import {
  buildCleanerPaymentHistory,
  CLEANER_PAYMENT_HISTORY_SOURCE_STATUSES,
  dedupeBookingsById,
} from '@/lib/cleaner-payment-history'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import type { BookingRead, ReviewRead, CleanerOnboardingProgress } from '@/types'
import { deriveCleanerLifecycleStatus } from '@/lib/cleaner-status'
import { parsePickupLocation, serializePickupLocation } from '@/lib/transport-pickup'
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

const SERVICE_OPTIONS = [
  'Regular home cleaning',
  'One-off cleaning',
  'Airbnb / short-term rental cleaning',
  'Laundry / folding clothes',
  'Kitchen deep clean',
  'Bathroom deep clean',
  'Ironing',
  'Windows',
  'Deep cleaning',
  'Move in/out',
]
const BIO_MAX_CHARS = 1000
const MIN_HOURLY_RATE = 6
const MAX_HOURLY_RATE = 25
const IMAGE_FILE_EXT_REGEX = /\.(png|jpe?g|webp|gif|bmp|svg)(?:[?#].*)?$/i

function isImageDocumentRef(url: string, fileName?: string) {
  return IMAGE_FILE_EXT_REGEX.test(url) || Boolean(fileName && IMAGE_FILE_EXT_REGEX.test(fileName))
}

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
  const [persistedPhone, setPersistedPhone] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false)
  const [verifyingPhoneOtp, setVerifyingPhoneOtp] = useState(false)
  const [phoneOtpCode, setPhoneOtpCode] = useState('')
  const [phoneVerificationModalOpen, setPhoneVerificationModalOpen] = useState(false)
  const [showInlinePhoneOtpEntry, setShowInlinePhoneOtpEntry] = useState(false)
  const [showModalPhoneOtpEntry, setShowModalPhoneOtpEntry] = useState(false)
  const [changeEmailModalOpen, setChangeEmailModalOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [changingEmail, setChangingEmail] = useState(false)
  const [changePhoneModalOpen, setChangePhoneModalOpen] = useState(false)
  const [newPhoneDraft, setNewPhoneDraft] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [yearsExperience, setYearsExperience] = useState('0')
  const [hourlyRate, setHourlyRate] = useState('15')
  const [transportMode, setTransportMode] = useState('')
  const [pickupLabel, setPickupLabel] = useState('')
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupPostcode, setPickupPostcode] = useState('')
  const [pickupMeetNotes, setPickupMeetNotes] = useState('')
  const [cleaningSupplies, setCleaningSupplies] = useState('')
  const [idType, setIdType] = useState('')
  const [idFileName, setIdFileName] = useState('')
  const [idFileUrl, setIdFileUrl] = useState('')
  const [uploadingKyc, setUploadingKyc] = useState(false)
  const [bio, setBio] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)

  const [completionPct, setCompletionPct] = useState<number>(100)
  const [onboardingSteps, setOnboardingSteps] = useState<CleanerOnboardingProgress['steps'] | null>(null)
  const [lifecycleStatus, setLifecycleStatus] = useState<
    'pending_approval' | 'approved' | 'live' | 'rejected' | 'suspended'
  >('pending_approval')
  const [rejectionReason, setRejectionReason] = useState<string>('')
  const [profileComplete, setProfileComplete] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [reviews, setReviews] = useState<ReviewRead[]>([])
  const [reviewReplyDrafts, setReviewReplyDrafts] = useState<Record<string, string>>({})
  const [replySubmittingId, setReplySubmittingId] = useState<string | null>(null)
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
  const [completedJobsCount, setCompletedJobsCount] = useState(0)
  const [averageRating, setAverageRating] = useState<number | null>(null)
  const [onTimePercentage, setOnTimePercentage] = useState(0)
  const [avgResponseMinutes, setAvgResponseMinutes] = useState(0)

  async function loadAll(showSkeleton = true) {
    if (showSkeleton) setLoading(true)
    try {
      const [meRes, stripeRes, paymentHistorySettled] = await Promise.all([
        cleanersApi.me(),
        paymentsApi.getConnectStatus(),
        Promise.allSettled(
          CLEANER_PAYMENT_HISTORY_SOURCE_STATUSES.map((status) =>
            bookingsApi.my(1, status, 50),
          ),
        ),
      ])

      const c = (meRes.data?.cleaner ?? {}) as any
      const onboarding = meRes.data?.onboarding
      const user = c.user ?? {}

      setCompletionPct(onboarding?.completion_pct ?? 0)
      setOnboardingSteps(onboarding?.steps ?? null)
      setLifecycleStatus(
        (c.lifecycle_status as any) ??
          deriveCleanerLifecycleStatus({
            status: c.status,
            stripeOnboardingComplete: c.stripe_onboarding_complete ?? c.stripeOnboardingComplete,
            profileComplete: c.profile_complete ?? c.profileComplete,
          }),
      )
      setRejectionReason(c.rejection_reason ?? '')
      setProfileComplete(c.profile_complete ?? false)

      setCleanerId(c.id ?? '')
      setFullName(user.name ?? '')
      setEmail(user.email ?? '')
      setEmailVerified(Boolean(user.email_confirmed_at))
      setPhone(user.phone ?? '')
      setPersistedPhone(user.phone ?? '')
      setPhoneVerified(Boolean(user.phone_verified_at))
      setYearsExperience(String(c.years_experience ?? c.yearsExperience ?? 0))
      setHourlyRate(String(c.hourly_rate ?? c.hourlyRate ?? 15))
      setTransportMode(c.transport_mode ?? c.transportMode ?? '')
      const pickupRaw = c.transport_pickup_location ?? c.transportPickupLocation ?? ''
      const pickupStructured = parsePickupLocation(pickupRaw)
      if (pickupStructured) {
        setPickupLabel(pickupStructured.label)
        setPickupAddress(pickupStructured.address)
        setPickupPostcode(pickupStructured.postcode ?? '')
        setPickupMeetNotes(pickupStructured.meetNotes ?? '')
      } else {
        setPickupLabel(String(pickupRaw ?? ''))
        setPickupAddress('')
        setPickupPostcode('')
        setPickupMeetNotes('')
      }
      setCleaningSupplies(c.cleaning_supplies ?? c.cleaningSupplies ?? '')
      setIdType(c.id_type ?? c.idType ?? '')
      setIdFileName(c.id_file_name ?? c.idFileName ?? '')
      setIdFileUrl(c.id_file_url ?? c.idFileUrl ?? '')
      setBio(c.bio ?? '')
      setSkills(c.skills ?? [])
      setProfileImageUrl(c.profile_image_url ?? c.profileImageUrl ?? null)
      setCompletedJobsCount(Number(c.total_jobs ?? c.totalJobs ?? 0))
      setAverageRating(c.average_rating ?? c.averageRating ?? null)
      setOnTimePercentage(Number(c.on_time_percentage ?? c.onTimePercentage ?? 0))
      setAvgResponseMinutes(Number(c.avg_response_minutes ?? c.avgResponseMinutes ?? 0))

      const names = String(user.name ?? '').trim().split(' ').filter(Boolean)
      setFirstName(names[0] ?? '')
      setLastName(names.slice(1).join(' '))

      const mergedPaymentBookings = dedupeBookingsById(
        paymentHistorySettled
          .flatMap((result) => (result.status === 'fulfilled' ? result.value.data?.items ?? [] : [])),
      )
      setBookings(mergedPaymentBookings)
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
      resetLoadError('cleaner-profile')
    } catch {
      reportLoadError('cleaner-profile', 'Failed to load profile.')
    } finally {
      if (showSkeleton) setLoading(false)
    }
  }

  useEffect(() => {
    loadAll(true)
  }, [])

  const googleCalendarState = params.get('google_calendar')
  const stripeState = params.get('stripe')
  useEffect(() => {
    if (!googleCalendarState) return
    if (googleCalendarState === 'connected') {
      toast.success('Google Calendar connected successfully.')
      googleCalendarApi.getStatus().catch(() => null)
    } else if (googleCalendarState === 'failed') {
      toast.error('Google Calendar connection failed. Please try again.')
    }
  }, [googleCalendarState])

  useEffect(() => {
    if (stripeState !== 'connected') return
    toast.success('Stripe connected.')
    loadAll(false).catch(() => null)
  }, [stripeState])

  const avgReview = useMemo(() => {
    if (reviews.length === 0) return 0
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
  }, [reviews])
  const displayAverageRating = averageRating ?? (reviews.length > 0 ? avgReview : 0)
  const initials = useMemo(() => {
    const parts = String(fullName || 'Cleaner')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
    return parts.map((part) => part[0] ?? '').join('').toUpperCase() || 'C'
  }, [fullName])

  const paymentHistory = useMemo(() => buildCleanerPaymentHistory(bookings), [bookings])
  const stripeFullyReady =
    stripe.connected &&
    stripe.payouts_enabled &&
    stripe.charges_enabled &&
    stripe.details_submitted

  const missingOnboardingParts = useMemo(() => {
    if (!onboardingSteps) return []
    const labels: Array<[keyof CleanerOnboardingProgress['steps'], string]> = [
      ['step1_basic_details', 'Basic details'],
      ['step2_kyc', 'KYC and legal details'],
      ['step3_availability', 'Availability schedule'],
      ['step4_stripe_setup', 'Stripe step'],
      ['step5_training', 'Cleaning standards quiz'],
    ]
    return labels.filter(([key]) => !onboardingSteps[key]).map(([, label]) => label)
  }, [onboardingSteps])
  const canEditKyc = lifecycleStatus === 'rejected' || !profileComplete
  const phoneNeedsVerification = phone.trim() !== (persistedPhone ?? '') || !phoneVerified

  function toggleSkill(skill: string) {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]))
  }

  function handlePhoneChange(nextPhone: string) {
    setPhone(nextPhone)
    if (nextPhone.trim() !== (persistedPhone ?? '')) {
      setPhoneVerified(false)
      setShowInlinePhoneOtpEntry(false)
      setShowModalPhoneOtpEntry(false)
    }
  }

  async function saveOverview() {
    if (!firstName.trim()) return toast.error('First name is required.')
    if (!lastName.trim()) return toast.error('Last name is required.')
    if (!phone.trim()) return toast.error('Phone is required.')
    if (Number(hourlyRate) < MIN_HOURLY_RATE || Number(hourlyRate) > MAX_HOURLY_RATE) {
      return toast.error(`Hourly rate must be between €${MIN_HOURLY_RATE} and €${MAX_HOURLY_RATE}.`)
    }
    if (!bio.trim()) return toast.error('Professional bio is required.')
    if (bio.trim().length > BIO_MAX_CHARS) return toast.error(`Professional bio can be up to ${BIO_MAX_CHARS} characters.`)
    if (skills.length === 0) return toast.error('Select at least one service.')
    if (!transportMode) return toast.error('Mode of transport is required.')
    if (!cleaningSupplies) return toast.error('Cleaning supplies setting is required.')
    if (transportMode === 'requires_pickup' && !pickupLabel.trim()) {
      return toast.error('Location label is required.')
    }
    if (transportMode === 'requires_pickup' && !pickupAddress.trim()) {
      return toast.error('Address / landmark is required.')
    }
    if (pickupMeetNotes.trim().length > 120) {
      return toast.error('Where to meet notes can be up to 120 characters.')
    }

    setSaving(true)
    try {
      const nextPhone = phone.trim()
      const phoneChanged = nextPhone !== (persistedPhone ?? '')
      if (phoneChanged && !phoneVerified) {
        setPhoneVerificationModalOpen(true)
        return
      }
      await usersApi.updateMe({
        name: `${firstName.trim()} ${lastName.trim()}`,
        ...(phoneChanged && !phoneVerified ? {} : { phone: nextPhone }),
      })
      if (!phoneChanged || phoneVerified) {
        setPersistedPhone(nextPhone)
      }
      await cleanersApi.updateMyOnboarding({
        years_experience: Number(yearsExperience),
        hourly_rate: Number(hourlyRate),
        cleaning_supplies: cleaningSupplies,
        transport_mode: transportMode,
        transport_pickup_location:
          transportMode === 'requires_pickup'
            ? serializePickupLocation({
                label: pickupLabel.trim(),
                address: pickupAddress.trim(),
                city: 'Larnaca',
                country: 'Cyprus',
                ...(pickupPostcode.trim() ? { postcode: pickupPostcode.trim() } : {}),
                ...(pickupMeetNotes.trim() ? { meetNotes: pickupMeetNotes.trim() } : {}),
              })
            : null,
        id_type: idType || null,
        id_file_name: idFileName || null,
        id_file_url: idFileUrl || null,
        bio,
        skills,
      })
      toast.success('Profile updated.')
      void loadAll(false)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  async function sendPhoneVerificationOtp() {
    if (!phone.trim()) return toast.error('Enter a phone number first.')
    setSendingPhoneOtp(true)
    try {
      await phoneVerificationApi.sendCode(phone.trim())
      setPhoneVerified(false)
      toast.success('Verification code sent by SMS.')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send phone verification code.')
    } finally {
      setSendingPhoneOtp(false)
    }
  }

  async function verifyPhoneOtpCode() {
    if (!phone.trim()) return toast.error('Phone number is required.')
    if (!phoneOtpCode.trim()) return toast.error('Enter the verification code.')
    setVerifyingPhoneOtp(true)
    try {
      await phoneVerificationApi.verifyCode(phone.trim(), phoneOtpCode.trim())
      setPhoneVerified(true)
      setPersistedPhone(phone.trim())
      setShowInlinePhoneOtpEntry(false)
      setShowModalPhoneOtpEntry(false)
      setPhoneVerificationModalOpen(false)
      setPhoneOtpCode('')
      toast.success('Phone verified.')
    } catch (err: any) {
      toast.error(err.message ?? 'Invalid verification code.')
    } finally {
      setVerifyingPhoneOtp(false)
    }
  }

  async function requestEmailChange() {
    if (!newEmail.trim()) return toast.error('Email is required.')
    setChangingEmail(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
      if (error) throw error
      toast.success('Verification email sent to the new address.')
      setChangeEmailModalOpen(false)
      setNewEmail('')
    } catch (err: any) {
      const rawMessage = String(err?.message ?? '')
      const normalized = rawMessage.toLowerCase()
      if (normalized.includes('error sending email change email')) {
        toast.error('Email change verification is not configured in SMTP templates yet. Please contact support.')
      } else if (normalized.includes('rate limit')) {
        toast.error('Too many email requests sent. Please wait a few minutes and try again.')
      } else {
        toast.error(rawMessage || 'Failed to request email change.')
      }
    } finally {
      setChangingEmail(false)
    }
  }


  async function submitForApproval() {
    setSubmitting(true)
    try {
      const authUserRes = await createClient().auth.getUser()
      if (!authUserRes.data.user?.email_confirmed_at) {
        toast.error('Please verify your email before submitting for approval.')
        return
      }
      if (phoneNeedsVerification) {
        toast.error('Please verify your phone number before submitting for approval.')
        return
      }
      await cleanersApi.submitForApproval()
      toast.success('Profile submitted for approval!')
      void loadAll(false)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit profile.')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitReviewReply(reviewId: string) {
    const draft = (reviewReplyDrafts[reviewId] ?? '').trim()
    if (!draft) {
      toast.error('Reply cannot be empty.')
      return
    }
    setReplySubmittingId(reviewId)
    try {
      await reviewsApi.replyToReview(reviewId, draft)
      toast.success('Reply posted. It cannot be edited after posting.')
      void loadAll(false)
      setReviewReplyDrafts((prev) => ({ ...prev, [reviewId]: '' }))
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to post reply.')
    } finally {
      setReplySubmittingId(null)
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
      window.location.assign(url)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to open Stripe.')
    }
  }

  async function uploadKycDocument(file: File) {
    if (!file) return
    setUploadingKyc(true)
    try {
      const token = await getAccessToken()
      const form = new FormData()
      form.append('file', file)

      const res = await fetch(toApiV1Url('/upload/kyc-document'), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success || !json.data?.url) {
        throw new Error(json.message ?? 'Failed to upload KYC document.')
      }

      setIdFileName(String(json.data.file_name ?? file.name))
      setIdFileUrl(String(json.data.url))
      toast.success('KYC document uploaded.')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to upload KYC document.')
    } finally {
      setUploadingKyc(false)
    }
  }

  if (loading) return <ProfilePageSkeleton />

  return (
    <div className="space-y-6">
      {(tab !== 'overview' || !stripe.connected) && (
        <p className="text-xs text-slate-500">
          Some profile updates may be limited until Stripe setup is completed.
        </p>
      )}

      {lifecycleStatus === 'rejected' ? (
        <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-3">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
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
      ) : lifecycleStatus === 'suspended' ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-900">Your account is suspended.</p>
          <p className="text-xs text-red-700">Contact support or admin to reactivate your account.</p>
        </div>
      ) : lifecycleStatus === 'pending_approval' && completionPct < 100 ? (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">Profile incomplete ({completionPct}%). Complete these sections:</p>
              {missingOnboardingParts.length > 0 ? (
                <p className="mt-1 text-xs text-amber-700">
                  {missingOnboardingParts.join(' • ')}
                </p>
              ) : (
                <p className="mt-1 text-xs text-amber-700">Complete all steps so your profile can be submitted for review.</p>
              )}
            </div>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-amber-200 shrink-0">
              <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${completionPct}%` }} />
            </div>
          </div>
        </div>
      ) : lifecycleStatus === 'pending_approval' && completionPct === 100 && !profileComplete ? (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-900">Your profile is complete.</p>
              <p className="text-xs text-blue-700">Submit your profile for admin review to start receiving bookings.</p>
            </div>
            <Button size="sm" onClick={submitForApproval} loading={submitting} className="shrink-0">
              Submit for approval
            </Button>
          </div>
        </div>
      ) : lifecycleStatus === 'pending_approval' && profileComplete ? (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div>
              <p className="text-sm font-semibold text-amber-900">Profile submitted — awaiting admin approval.</p>
              <p className="text-xs text-amber-700">You'll be notified once your profile is reviewed. Once approved, you'll start receiving booking requests.</p>
            </div>
          </div>
        </div>
      ) : lifecycleStatus === 'approved' && !stripe.connected ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Approved — connect Stripe to go live. You must connect Stripe to accept bookings and receive payouts. Go to: Profile → Payments to complete setup.</p>
        </div>
      ) : lifecycleStatus === 'live' ? (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-900">Live — your profile is approved and visible to clients.</p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card className="border-slate-200">
            <CardContent className="p-5 !pt-6 text-center">
              <div className="mx-auto mb-3">
                <AvatarUpload
                  currentUrl={profileImageUrl}
                  fallbackInitial={initials}
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
                  {displayAverageRating ? displayAverageRating.toFixed(1) : '0.0'} ({reviews.length} reviews)
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="space-y-2 p-5 !pt-6 text-sm">
              <p className="font-semibold text-slate-900">Performance Stats</p>
              <div className="flex items-center justify-between text-slate-600"><span>Completed Jobs</span><strong>{completedJobsCount}</strong></div>
              <div className="flex items-center justify-between text-slate-600"><span>Average Rating</span><strong>{displayAverageRating ? displayAverageRating.toFixed(1) : '0.0'}</strong></div>
              <div className="flex items-center justify-between text-slate-600"><span>On-time Rate</span><strong>{onTimePercentage}%</strong></div>
              <div className="flex items-center justify-between text-slate-600"><span>Average Response Time</span><strong>{avgResponseMinutes} min</strong></div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="space-y-2 p-5 !pt-6">
              <p className="font-semibold text-slate-900">Quick Actions</p>
              <button onClick={() => setTab('overview')} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"><ChartNoAxesCombined className="h-4 w-4 text-primary" />View Overview</button>
              <button onClick={() => setTab('availability')} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"><CalendarDays className="h-4 w-4 text-primary" />Update Availability</button>
              <button onClick={() => setTab('reviews')} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"><Star className="h-4 w-4 text-primary" />Manage Reviews</button>
              <button onClick={() => setTab('payments')} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"><Wallet className="h-4 w-4 text-primary" />Payout Settings</button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200">
          <CardContent className="px-4 pb-4 pt-6 md:px-6 md:pb-6 md:pt-6">
            <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">Identity</p>
                  <p className="mt-1 text-xs text-slate-600">Name: {firstName} {lastName}</p>
                  <p className="mt-1 text-xs text-slate-600">Email: {email || 'Not set'}</p>
                  <p className="mt-1 text-xs text-slate-600">Email changes are managed in Account Credentials.</p>
                  <p className="mt-1 text-xs text-slate-600">Phone is managed in Account Credentials.</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">Professional Information</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div><Label>First Name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" /></div>
                    <div><Label>Last Name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" /></div>
                    <div><Label>Years of Experience</Label><Input type="number" min={0} value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} className="mt-1" /></div>
                  </div>
                  <div className="mt-3">
                    <Label>Professional Bio</Label>
                    <p className="mt-1 text-xs text-slate-500">Describe your experience, the types of cleaning you specialise in, and how you like to work.</p>
                    <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={6} maxLength={BIO_MAX_CHARS} className="mt-1" />
                    <p className="text-xs text-slate-500 mt-1">Maximum {BIO_MAX_CHARS} characters.</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">Service Configuration</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div><Label>Hourly Rate (€{MIN_HOURLY_RATE}–€{MAX_HOURLY_RATE})</Label><Input type="number" min={MIN_HOURLY_RATE} max={MAX_HOURLY_RATE} value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="mt-1" /></div>
                    <div>
                      <Label>Cleaning supplies</Label>
                      <Select value={cleaningSupplies} onChange={(e) => setCleaningSupplies(e.target.value)} className="mt-1">
                        <option value="">Choose an option...</option>
                        <option value="own_supplies">I bring cleaning supplies</option>
                        <option value="client_supplies">Client must provide cleaning supplies</option>
                      </Select>
                    </div>
                    <div>
                      <Label>Mode of Transport</Label>
                      <Select value={transportMode} onChange={(e) => setTransportMode(e.target.value)} className="mt-1">
                        <option value="">Choose an option...</option>
                        <option value="own_car">Own car</option>
                        <option value="bus_walk">Public transport / no lift needed</option>
                        <option value="requires_pickup">Requires pick-up and drop-off</option>
                      </Select>
                    </div>
                  </div>
                  {transportMode === 'requires_pickup' && (
                    <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                      <div><Label>Location label</Label><Input value={pickupLabel} onChange={(e) => setPickupLabel(e.target.value)} className="mt-1" placeholder="Finikoudes bus stop" /></div>
                      <div><Label>Address / landmark</Label><Input value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} className="mt-1" placeholder="Finikoudes promenade, near main bus stop" /></div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div><Label>City</Label><Input value="Larnaca" disabled className="mt-1" /></div>
                        <div><Label>Country</Label><Input value="Cyprus" disabled className="mt-1" /></div>
                      </div>
                      <div><Label>Postcode (optional)</Label><Input value={pickupPostcode} onChange={(e) => setPickupPostcode(e.target.value)} className="mt-1" placeholder="6015" /></div>
                      <div>
                        <Label>Where to meet notes (optional)</Label>
                        <Textarea value={pickupMeetNotes} onChange={(e) => setPickupMeetNotes(e.target.value.slice(0, 120))} rows={2} className="mt-1" placeholder="Example: Wait near the main bus stop sign." />
                        <p className="mt-1 text-xs text-slate-500">{pickupMeetNotes.length}/120</p>
                      </div>
                      <p className="text-xs text-slate-500">Pick-up/drop-off locations must be within Larnaca.</p>
                      <p className="text-xs text-slate-500">Choose a safe nearby public location where clients can pick you up and drop you off for bookings. You can confirm exact details in chat after the booking is confirmed.</p>
                    </div>
                  )}
                  <div className="mt-3">
                    <Label>Services you offer</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {SERVICE_OPTIONS.map((skill) => (
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
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">Account Credentials</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Email: {email || 'Not set'} ({emailVerified ? 'Verified' : 'Not verified'})
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Phone: {phone || 'Not set'} ({phoneNeedsVerification ? 'Not verified' : 'Verified'})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => setChangeEmailModalOpen(true)} className="h-8 px-3 text-xs">
                      Change Email
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setNewPhoneDraft(phone); setChangePhoneModalOpen(true) }} className="h-8 px-3 text-xs">
                      Change Phone
                    </Button>
                  </div>
                  {phoneNeedsVerification && (
                    <>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            setShowInlinePhoneOtpEntry(true)
                            await sendPhoneVerificationOtp()
                          }}
                          loading={sendingPhoneOtp}
                          className="h-8 px-3 text-xs"
                        >
                          Verify now
                        </Button>
                      </div>
                      {showInlinePhoneOtpEntry && (
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={phoneOtpCode}
                            onChange={(event) => setPhoneOtpCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                            placeholder="Enter OTP code"
                            inputMode="numeric"
                            className="sm:max-w-[180px]"
                          />
                          <Button type="button" variant="outline" onClick={verifyPhoneOtpCode} loading={verifyingPhoneOtp} className="h-10 px-3 text-xs sm:w-auto">
                            Confirm Code
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">ID Document</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Your ID document is used to review your cleaner application.
                  </p>
                  {!canEditKyc && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                      Your ID document is locked while your application is under review or approved. If your application is rejected because of document issues, you can upload a corrected document and resubmit.
                    </p>
                  )}
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>ID Type</Label>
                      <Select value={idType} onChange={(e) => setIdType(e.target.value)} className="mt-1" disabled={!canEditKyc}>
                        <option value="">Choose an option...</option>
                        <option value="passport">Passport</option>
                        <option value="national_id">National ID card</option>
                        <option value="drivers_licence">Driver&apos;s licence</option>
                      </Select>
                    </div>
                    <div>
                      <Label>KYC File</Label>
                      <Input
                        type="file"
                        className="mt-1"
                        accept=".pdf,image/*"
                        disabled={uploadingKyc || !canEditKyc}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          await uploadKycDocument(file)
                        }}
                      />
                    </div>
                  </div>
                  {(idFileName || idFileUrl) && (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                      <p className="text-xs font-medium text-slate-700">Current file</p>
                      {idFileUrl ? (
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                          {isImageDocumentRef(idFileUrl, idFileName) ? (
                            <a href={idFileUrl} target="_blank" rel="noreferrer" className="block">
                              <img
                                src={idFileUrl}
                                alt={idFileName || 'KYC file'}
                                className="h-14 w-14 rounded-md border border-slate-200 object-cover"
                              />
                            </a>
                          ) : (
                            <div className="grid h-14 w-14 place-items-center rounded-md border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-500">
                              FILE
                            </div>
                          )}
                          <a href={idFileUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline">
                            {idFileName || 'Open uploaded document'}
                          </a>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-slate-600">{idFileName}</p>
                      )}
                    </div>
                  )}
                </div>


                <div className="flex justify-end">
                  <Button onClick={saveOverview} loading={saving}>Save & Publish</Button>
                </div>
              </div>
            )}

            {tab === 'availability' && (
              <div className="pb-1">
                <ScheduleEditor />
              </div>
            )}

            {tab === 'reviews' && (
              <div className="space-y-3">
                {reviews.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    No reviews yet
                  </div>
                ) : (
                  reviews.map((r) => {
                    const clientName = r.client?.user?.name?.trim() || 'Client'
                    const clientFirstName = clientName.split(/\s+/)[0] || 'Client'
                    const bookingDate = r.booking?.scheduled_start
                      ? new Date(r.booking.scheduled_start).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Nicosia' })
                      : new Date(r.created_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Nicosia' })
                    return (
                    <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="mb-1 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">Review from {clientFirstName}</p>
                          <p className="text-xs text-slate-500">Booking: {bookingDate}</p>
                          <p className="text-[11px] text-slate-400">Ref: {r.booking_id.slice(0, 8)}</p>
                        </div>
                        <div className="flex items-center gap-1 text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-4 w-4 ${i < r.rating ? 'fill-current' : ''}`} />
                          ))}
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{r.comment || 'No written comment provided.'}</p>
                      {r.cleaner_reply ? (
                        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                          <p className="text-xs font-semibold text-blue-900">Your public reply</p>
                          <p className="mt-1 text-sm text-blue-900">{r.cleaner_reply}</p>
                          {r.cleaner_reply_at && (
                            <p className="mt-1 text-xs text-blue-700">
                              Posted {new Date(r.cleaner_reply_at).toLocaleDateString('en-IE', { timeZone: 'Europe/Nicosia' })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <Label className="text-xs">Public reply (one-time, cannot be edited)</Label>
                          <p className="text-xs text-slate-600">
                            Reply professionally. This response will be visible on your public profile and cannot be edited.
                          </p>
                          <Textarea
                            value={reviewReplyDrafts[r.id] ?? ''}
                            onChange={(event) =>
                              setReviewReplyDrafts((prev) => ({ ...prev, [r.id]: event.target.value }))
                            }
                            rows={3}
                            placeholder="Thank the client and provide a short professional response."
                          />
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              onClick={() => submitReviewReply(r.id)}
                              loading={replySubmittingId === r.id}
                            >
                              Post Reply
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    )
                  })
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
                      {!stripeFullyReady && (
                        <p className="mt-1 text-sm font-medium text-amber-700">You must connect Stripe to accept bookings and receive payouts. Go to: Profile → Payments to complete setup.</p>
                      )}
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

                {!stripeFullyReady && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Connect Stripe to accept bookings and receive payouts. Go to: Profile → Payments to complete setup.
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
                      {paymentHistory.map(({ booking: b, label, tone }) => (
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
                        <div className="w-full text-left sm:w-auto sm:text-right">
                            <p className="text-sm font-semibold text-emerald-700">{formatCurrency(b.cleaner_payout)}</p>
                            <p className={`text-xs ${
                              tone === 'issue'
                                ? 'text-red-700'
                                : tone === 'warn'
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                            }`}>
                              {label}
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
      <Dialog
        open={phoneVerificationModalOpen}
        onClose={() => {
          setPhoneVerificationModalOpen(false)
          setShowModalPhoneOtpEntry(false)
        }}
      >
        <DialogTitle>Verify phone number</DialogTitle>
        <p className="text-sm text-slate-600">You changed your phone number. Verify it to continue saving.</p>
        <p className="mt-2 text-sm font-medium text-slate-800">{phone || 'No phone set'}</p>
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              setShowModalPhoneOtpEntry(true)
              await sendPhoneVerificationOtp()
            }}
            loading={sendingPhoneOtp}
          >
            Verify now
          </Button>
        </div>
        {showModalPhoneOtpEntry && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={phoneOtpCode}
              onChange={(event) => setPhoneOtpCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Enter OTP code"
              inputMode="numeric"
            />
            <Button type="button" variant="outline" onClick={verifyPhoneOtpCode} loading={verifyingPhoneOtp} className="sm:w-auto">
              Confirm Code
            </Button>
          </div>
        )}
      </Dialog>
      <Dialog
        open={changeEmailModalOpen}
        onClose={() => setChangeEmailModalOpen(false)}
      >
        <DialogTitle>Change email</DialogTitle>
        <p className="text-sm text-slate-600">A verification email will be sent to the new address. Your current email stays active until verified.</p>
        <Input
          className="mt-3"
          type="email"
          placeholder="Enter new email"
          value={newEmail}
          onChange={(event) => setNewEmail(event.target.value)}
        />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setChangeEmailModalOpen(false)}>Cancel</Button>
          <Button type="button" onClick={requestEmailChange} loading={changingEmail}>Send verification</Button>
        </div>
      </Dialog>
      <Dialog
        open={changePhoneModalOpen}
        onClose={() => setChangePhoneModalOpen(false)}
      >
        <DialogTitle>Change phone</DialogTitle>
        <p className="text-sm text-slate-600">Your current phone stays active until the new number is verified.</p>
        <PhoneInput value={newPhoneDraft} onChange={setNewPhoneDraft} className="mt-3" />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setChangePhoneModalOpen(false)}>Cancel</Button>
          <Button
            type="button"
            onClick={() => {
              if (!newPhoneDraft.trim()) {
                toast.error('Phone number is required.')
                return
              }
              handlePhoneChange(newPhoneDraft)
              setChangePhoneModalOpen(false)
              setPhoneVerificationModalOpen(true)
            }}
          >
            Continue
          </Button>
        </div>
      </Dialog>
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
