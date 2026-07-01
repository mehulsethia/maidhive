'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Clock, ExternalLink, Lock, Shield, Star, X } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { cleanersApi, bookingsApi, availabilityApi, clientsApi, paymentsApi, phoneVerificationApi } from '@/lib/api'
import { FormPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookableCalendar } from '@/components/ui/bookable-calendar'
import { UserAvatar } from '@/components/ui/user-avatar'
import { PlatformFeeNotice } from '@/components/platform-fee-notice'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { formatCurrency, cn, APP_TIMEZONE } from '@/lib/utils'
import { MAX_SAVED_ADDRESSES, MVP_CITY, normalizeCyprusPostcode } from '@/lib/location-policy'
import { pickupFullLabel } from '@/lib/transport-pickup'
import { getClientBookingRequestDeadlineCopy } from '@/lib/booking-expiry-copy'
import { calculatePlatformFee, isMinimumPlatformFeeApplied, roundMoney } from '@/lib/platform-fee'
import type { CleanerRead, PriceBreakdown, BookingRead, ClientProfileRead, ClientAddressRead } from '@/types'
import { toast } from 'sonner'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}

const DURATION_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8]
const NOTES_MIN_CHARS = 12
const MAX_JOB_PHOTOS = 5
const MAX_SPECIAL_INSTRUCTIONS_CHARS = 5000
const BOOKING_FLOW_DRAFT_VERSION = 1

const JOB_TYPE_OPTIONS = [
  { value: 'regular_clean', label: 'Regular clean', serviceType: 'standard' as const },
  { value: 'one_off_clean', label: 'One-off clean', serviceType: 'standard' as const },
  { value: 'deep_clean', label: 'Deep clean', serviceType: 'deep_clean' as const },
  { value: 'move_out_end_of_tenancy', label: 'Move-out / End of tenancy', serviceType: 'end_of_tenancy' as const },
] as const

const BEDROOM_OPTIONS = ['Studio', '1', '2', '3', '4', '5+'] as const
const BATHROOM_OPTIONS = ['1', '2', '3', '4+'] as const

const PROPERTY_CONDITION_OPTIONS = [
  { value: 'light_well_maintained', label: 'Light / well maintained' },
  { value: 'normal', label: 'Normal' },
  { value: 'needs_extra_attention', label: 'Needs extra attention' },
  { value: 'very_dirty_heavy_clean', label: 'Very dirty / heavy clean' },
] as const

const SUPPLIES_OPTIONS = [
  { value: 'client_provides', label: 'Provided by client' },
  { value: 'cleaner_brings', label: 'Provided by cleaner' },
] as const

const STEP_INFO = [
  { num: 1, title: 'Select Date & Time', desc: 'Choose duration, date, and time' },
  { num: 2, title: 'Address & Job Details', desc: 'Contact and job information' },
  { num: 3, title: 'Payment', desc: 'Card authorisation' },
  { num: 4, title: 'Confirmation', desc: 'Booking confirmation' },
]

type BookingFlowDraft = {
  version: number
  revision: number
  updatedAt: string
  step: number
  duration: number
  date: string
  selectedSlot: string
  bookingId: string
}

type BookingSnapshotDetails = {
  jobType: string
  bedrooms: string
  bathrooms: string
  propertyCondition: string
  supplies: string
  needsCleaning: string
  photos: string[]
}

function isPaymentAuthorizedStatus(status?: string | null) {
  return ['authorized', 'captured', 'transferred'].includes(String(status ?? ''))
}

function bookingExpiryMessage(acceptBy?: string | null) {
  return getClientBookingRequestDeadlineCopy({ accept_by: acceptBy ?? null })
}

function normalizeToIsoDatetime(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function normalizePostcodeInput(value: string): string {
  return normalizeCyprusPostcode(value)
}

function camelToSnakeKey(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

function readKey(source: Record<string, any> | null | undefined, camelKey: string) {
  if (!source) return undefined
  const snakeKey = camelToSnakeKey(camelKey)
  if (source[camelKey] !== undefined) return source[camelKey]
  if (source[snakeKey] !== undefined) return source[snakeKey]
  return undefined
}

function normalizeFlowDraftPayload(
  payload: unknown,
  serverDraft?: Record<string, any> | null,
): BookingFlowDraft | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined
  const raw = payload as Record<string, any>
  const rawDuration = readKey(raw, 'duration')
  const rawDate = readKey(raw, 'date')
  const rawSlot = readKey(raw, 'selectedSlot')

  return {
    version: Number(readKey(raw, 'version') || BOOKING_FLOW_DRAFT_VERSION),
    revision: Number(readKey(raw, 'revision') || 0),
    updatedAt: String(readKey(raw, 'updatedAt') || readKey(raw, 'updated_at') || ''),
    step: Number(readKey(raw, 'step') || readKey(serverDraft ?? undefined, 'lastStep') || 1),
    duration: Number(rawDuration || readKey(serverDraft ?? undefined, 'durationHours') || 1),
    date: String(rawDate || readKey(serverDraft ?? undefined, 'selectedDate') || ''),
    selectedSlot: String(rawSlot || readKey(serverDraft ?? undefined, 'selectedSlot') || ''),
    bookingId: String(readKey(raw, 'bookingId') || readKey(serverDraft ?? undefined, 'bookingId') || ''),
  }
}

function parseDraftTimestamp(value?: string): number {
  const parsed = Date.parse(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function parseBookingSnapshotDetails(specialInstructions?: string | null): BookingSnapshotDetails {
  const value = String(specialInstructions ?? '')
  const lines = value.split('\n')
  const readLine = (prefix: string) => {
    const row = lines.find((line) => line.toLowerCase().startsWith(`${prefix.toLowerCase()}:`))
    return row ? row.split(':').slice(1).join(':').trim() : ''
  }
  const photosLine = lines.find((line) => line.toLowerCase().startsWith('job photos'))
  const photos = photosLine
    ? photosLine
        .split(':')
        .slice(1)
        .join(':')
        .split(',')
        .map((url) => url.trim())
        .filter((url) => /^https?:\/\//i.test(url))
    : []
  return {
    jobType: readLine('Job type'),
    bedrooms: readLine('Bedrooms'),
    bathrooms: readLine('Bathrooms'),
    propertyCondition: readLine('Property condition'),
    supplies: readLine('Cleaning supplies'),
    needsCleaning: readLine('What needs to be cleaned'),
    photos,
  }
}

// ── Step indicator ────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEP_INFO.map((s, idx) => {
        const done = current > s.num
        const active = current === s.num
        return (
          <div key={s.num} className="flex items-center">
            <div className="flex w-16 flex-col items-center sm:w-24">
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${done ? 'bg-primary text-white' : active ? 'bg-primary text-white ring-4 ring-primary/20' : 'bg-slate-100 text-slate-400'
                  }`}
              >
                {done ? <Check className="h-4 w-4" /> : s.num}
              </div>
              <p className={`mt-1.5 text-center text-[10px] leading-tight ${active || done ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
                {s.title}
              </p>
              <p className="text-[9px] text-slate-400 text-center leading-tight hidden sm:block">{s.desc}</p>
            </div>
            {idx < STEP_INFO.length - 1 && (
              <div className={`h-0.5 w-8 sm:w-14 -mt-5 sm:-mt-7 ${current > s.num ? 'bg-primary' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Horizontal Date Picker ────────────────────────────────────────────────
function DatePicker({
  availableDates,
  selectedDate,
  onSelect,
}: {
  availableDates: string[]
  selectedDate: string
  onSelect: (date: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollPos, setScrollPos] = useState(0)

  function scroll(dir: 'left' | 'right') {
    if (!scrollRef.current) return
    const amount = 300
    const target = dir === 'left' ? scrollRef.current.scrollLeft - amount : scrollRef.current.scrollLeft + amount
    scrollRef.current.scrollTo({ left: target, behavior: 'smooth' })
  }

  function handleScroll() {
    if (scrollRef.current) setScrollPos(scrollRef.current.scrollLeft)
  }

  const canScrollLeft = scrollPos > 0
  const canScrollRight = scrollRef.current
    ? scrollPos < scrollRef.current.scrollWidth - scrollRef.current.clientWidth - 1
    : availableDates.length > 5

  if (availableDates.length === 0) {
    return <p className="text-sm text-slate-500">No available dates found for this cleaner.</p>
  }

  return (
    <div className="relative overflow-hidden">
      {/* Left arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Scrollable dates — shows ~5 blocks, scroll for more */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-2 overflow-x-auto scrollbar-hide py-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', paddingLeft: canScrollLeft ? 36 : 4, paddingRight: 36 }}
      >
        {availableDates.map(dateStr => {
          const d = new Date(dateStr + 'T12:00:00Z') // noon UTC to avoid timezone shift
          const dayName = d.toLocaleDateString('en-IE', { weekday: 'short', timeZone: APP_TIMEZONE })
          const dayNum = d.getUTCDate()
          const month = d.toLocaleDateString('en-IE', { month: 'short', timeZone: APP_TIMEZONE })
          const isSelected = selectedDate === dateStr

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelect(dateStr)}
              className={`shrink-0 flex flex-col items-center justify-center rounded-xl border-2 px-4 py-3 w-[80px] transition-all ${isSelected
                ? 'border-primary bg-primary/5 text-primary shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:-translate-y-0.5'
                }`}
            >
              <span className={`text-xs font-medium ${isSelected ? 'text-primary' : 'text-slate-500'}`}>{dayName}</span>
              <span className="text-lg font-bold">{dayNum}</span>
              <span className={`text-xs ${isSelected ? 'text-primary' : 'text-slate-500'}`}>{month}</span>
            </button>
          )
        })}
      </div>

      {/* Right arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}

// ── Booking Summary Sidebar ───────────────────────────────────────────────
function BookingSummary({
  cleaner,
  duration,
  breakdown,
  jobType,
  date,
  selectedSlot,
  city,
  postcode,
}: {
  cleaner: CleanerRead
  duration: number
  breakdown: PriceBreakdown | null
  jobType: string
  date: string
  selectedSlot: string
  city: string
  postcode: string
}) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const cleanerName = cleaner.user?.name ?? 'Professional Cleaner'
  const serviceCost = breakdown?.subtotal ?? roundMoney(cleaner.hourly_rate * duration)
  const platformFee = breakdown?.platform_fee ?? calculatePlatformFee(serviceCost)
  const total = breakdown?.total_amount ?? roundMoney(serviceCost + platformFee)
  const minimumFeeApplied = isMinimumPlatformFeeApplied({
    subtotal: serviceCost,
    platformFee,
    platformFeePct: breakdown?.platform_fee_pct ?? 10,
  })
  const transportLabel =
    cleaner.transport_mode === 'own_car'
      ? 'Own transport'
      : cleaner.transport_mode === 'bus_walk'
        ? 'Bus / Walk'
        : cleaner.transport_mode === 'requires_pickup'
          ? 'Requires pickup/drop-off'
          : 'Not set'
  const suppliesLabel =
    cleaner.cleaning_supplies === 'own_supplies'
      ? 'Brings own supplies'
      : cleaner.cleaning_supplies === 'client_supplies'
        ? 'Client must provide supplies'
      : 'Not set'
  const selectedJobType = JOB_TYPE_OPTIONS.find((option) => option.value === jobType)
  const serviceTypeLabel = selectedJobType?.label ?? 'Cleaning Service'
  const selectedDateLabel = date
    ? new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: APP_TIMEZONE,
    })
    : 'Not selected'
  const selectedTimeLabel = selectedSlot
    ? new Date(selectedSlot).toLocaleTimeString('en-IE', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: APP_TIMEZONE })
    : 'Not selected'
  return (
    <Card className="rounded-2xl border-slate-200 sticky top-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold">Booking Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Cleaner info */}
        <div className="flex items-center gap-3">
          <UserAvatar
            name={cleanerName}
            imageUrl={cleaner.profile_image_url}
            className="h-10 w-10"
            textClassName="text-sm font-bold"
            fallbackClassName="bg-primary/10 text-primary"
            fallback="C"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-slate-900 truncate">{cleanerName}</p>
            <div className="flex items-center gap-1">
              <div className="flex items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3 w-3 ${i < Math.round(cleaner.average_rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                ))}
              </div>
              <span className="text-xs text-slate-500">{cleaner.average_rating?.toFixed(1) ?? '—'}/5</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Service details */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
            <span className="text-slate-700">{serviceTypeLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            <span>{duration} hour{duration !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Date</span>
            <span className="text-right">{selectedDateLabel}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Start time</span>
            <span>{selectedTimeLabel}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Area</span>
            <span>{city || 'Not set'}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Postcode</span>
            <span>{postcode || 'Not set'}</span>
          </div>
        </div>

        <Separator />

        <div className="space-y-2 text-sm pt-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-900 font-semibold">Total</span>
            <span className="text-lg text-primary font-bold">{formatCurrency(total)}</span>
          </div>
          <p className="text-xs text-slate-500">Includes secure booking &amp; support fee</p>
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {showBreakdown ? 'Hide price breakdown' : 'View price breakdown'}
          </button>
          {showBreakdown && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Service ({duration}h)</span>
                <span className="font-semibold text-slate-900">{formatCurrency(serviceCost)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">
                  Secure booking &amp; support fee{minimumFeeApplied ? '' : ' (10%)'}
                </span>
                <span className="font-semibold text-slate-900">{formatCurrency(platformFee)}</span>
              </div>
              <PlatformFeeNotice
                subtotal={serviceCost}
                platformFee={platformFee}
                platformFeePct={breakdown?.platform_fee_pct ?? 10}
              />
              <Separator className="my-2" />
              <div className="flex justify-between items-center font-bold">
                <span className="text-slate-900">Total</span>
                <span className="text-lg text-primary">{formatCurrency(total)}</span>
              </div>
            </>
          )}
        </div>

        <Separator />
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-slate-900">Cleaner Details</p>
          <p className="text-slate-600">Transport: {transportLabel}</p>
          {cleaner.transport_mode === 'requires_pickup' && Boolean((cleaner as any).transport_pickup_location) && (
            <p className="text-slate-600">Pick-up location: {pickupFullLabel((cleaner as any).transport_pickup_location)}</p>
          )}
          <p className="text-slate-600">Supplies: {suppliesLabel}</p>
          <p className="text-slate-600">Rating: {cleaner.average_rating?.toFixed(1) ?? 'N/A'}</p>
          <p className="text-slate-600">Completed jobs: {cleaner.total_jobs ?? 0}</p>
          <p className="text-slate-600">Experience: {cleaner.years_experience ?? 0} years</p>
        </div>

        {/* Trust signals */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Shield className="h-3.5 w-3.5 text-slate-400" /> Secure payment processing
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5 text-slate-400" /> Structured cancellation policy applies
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5 text-slate-400" /> 24h issue reporting window after completion
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Stripe Payment Form (inner) ──────────────────────────────────────────
function StripePaymentForm({
  booking,
  onSuccess,
  validateBeforeSubmit,
  onCancelRequest,
  cancelRequestLoading = false,
}: {
  booking: BookingRead
  onSuccess: () => Promise<void>
  validateBeforeSubmit: () => Promise<string[]>
  onCancelRequest?: () => Promise<void> | void
  cancelRequestLoading?: boolean
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<'saved' | 'new'>('new')
  const [savedCards, setSavedCards] = useState<Array<{
    id: string
    brand: string
    last4: string
    exp_month: number | null
    exp_year: number | null
  }>>([])
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string>('')
  const [showBreakdown, setShowBreakdown] = useState(false)
  const bookingSubtotal = booking.subtotal ?? (booking.total_amount - booking.platform_fee)
  const minimumFeeApplied = isMinimumPlatformFeeApplied({
    subtotal: bookingSubtotal,
    platformFee: booking.platform_fee,
    platformFeePct: booking.platform_fee_pct ?? 10,
  })

  useEffect(() => {
    paymentsApi.listMethods()
      .then((res) => {
        const cards = res.data ?? []
        setSavedCards(cards)
        if (cards.length > 0) {
          setMode('saved')
          setSelectedSavedCardId(cards[0].id)
        } else {
          setMode('new')
        }
      })
      .catch(() => {
        setSavedCards([])
        setMode('new')
      })
  }, [])

  async function handleSubmit() {
    const missingItems = await validateBeforeSubmit()
    if (mode === 'saved' && !selectedSavedCardId) {
      missingItems.push('Add payment method')
    }
    if (missingItems.length > 0) {
      toast.error(
        `Complete your account to send this booking request: ${missingItems.join(', ')}`,
      )
      return
    }

    if (mode === 'saved') {
      if (!selectedSavedCardId) {
        toast.error('Select a saved card or choose to add a new card.')
        return
      }
      setSubmitting(true)
      try {
        await paymentsApi.confirmWithSavedMethod(booking.id, selectedSavedCardId)
        await onSuccess()
        toast.success('Saved card authorised. Booking request sent to the cleaner.')
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to authorise saved card.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!stripe || !elements) return
    setSubmitting(true)
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/client/bookings`,
        },
      })
      if (error) {
        toast.error(error.message ?? 'Payment failed. Please try again.')
      } else {
        await onSuccess()
        toast.success('Card authorised. Booking request sent to the cleaner.')
      }
    } catch {
      toast.error('Card was authorised, but booking sync failed. Please retry in Bookings.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
        <Lock className="h-4 w-4 text-emerald-600 shrink-0" />
        <p className="text-sm text-emerald-700">Your payment information is secure and encrypted</p>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 p-3">
        <p className="text-sm font-semibold text-slate-900">Payment option</p>
        {savedCards.length > 0 && (
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2">
            <input
              type="radio"
              name="payment-option"
              checked={mode === 'saved'}
              onChange={() => setMode('saved')}
              className="mt-1"
            />
            <span className="text-sm text-slate-700">Use a previously saved card</span>
          </label>
        )}
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2">
          <input
            type="radio"
            name="payment-option"
            checked={mode === 'new'}
            onChange={() => setMode('new')}
            className="mt-1"
          />
          <span className="text-sm text-slate-700">Add and use a new card</span>
        </label>
      </div>

      {mode === 'saved' && savedCards.length > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          {savedCards.map((card) => (
            <label key={card.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-2">
              <input
                type="radio"
                name="saved-card"
                checked={selectedSavedCardId === card.id}
                onChange={() => setSelectedSavedCardId(card.id)}
              />
              <span className="text-sm text-slate-700">
                {card.brand.toUpperCase()} •••• {card.last4}
                {card.exp_month && card.exp_year ? ` (exp ${card.exp_month}/${card.exp_year})` : ''}
              </span>
            </label>
          ))}
        </div>
      )}

      {mode === 'new' && <PaymentElement />}

      <p className="text-xs text-slate-500">
        I agree to the Terms of Service and Privacy Policy. I understand that payment will be processed securely.
      </p>
      <p className="text-sm font-medium text-slate-700">
        Your card will NOT be charged now. Payment is only captured after the job is completed.
      </p>
      <p className="text-xs text-slate-500">{bookingExpiryMessage(booking.accept_by)}</p>

      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-900 font-semibold">Total: {formatCurrency(booking.total_amount)}</span>
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {showBreakdown ? 'Hide price breakdown' : 'View price breakdown'}
          </button>
        </div>
        <p className="text-xs text-slate-500">Includes secure booking &amp; support fee</p>
        {showBreakdown && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
            <p>{formatCurrency(booking.hourly_rate)} × {booking.duration_hours}h = {formatCurrency(bookingSubtotal)}</p>
            <p>Secure booking &amp; support fee{minimumFeeApplied ? '' : ' (10%)'} = {formatCurrency(booking.platform_fee)}</p>
            <PlatformFeeNotice
              subtotal={bookingSubtotal}
              platformFee={booking.platform_fee}
              platformFeePct={booking.platform_fee_pct ?? 10}
            />
            <p className="font-semibold text-slate-900">Total = {formatCurrency(booking.total_amount)}</p>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          {onCancelRequest ? (
            <Button
              type="button"
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              onClick={() => void onCancelRequest()}
              loading={cancelRequestLoading}
              disabled={submitting}
            >
              Cancel draft
            </Button>
          ) : (
            <span />
          )}
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={cancelRequestLoading || (mode === 'new' ? (!stripe || !elements) : !selectedSavedCardId)}
          >
            Authorise & Send Request
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function BookingFlowPage() {
  const { cleanerId } = useParams<{ cleanerId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const continueDraft = searchParams.get('continue') === '1'
  const continueBookingId = searchParams.get('bookingId')?.trim() || ''
  const resetDraft = searchParams.get('reset') === '1' || searchParams.get('fresh') === '1'
  const openedFromBookings = searchParams.get('source') === 'bookings'
  const paymentResumeMode = continueDraft && Boolean(continueBookingId) && !resetDraft
  const stepFromUrl = Math.min(Math.max(Number(searchParams.get('step') ?? (paymentResumeMode ? '3' : '1')), 1), 4)

  const [cleaner, setCleaner] = useState<CleanerRead | null>(null)
  const [clientProfile, setClientProfile] = useState<ClientProfileRead | null>(null)
  const [savedAddresses, setSavedAddresses] = useState<ClientAddressRead[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(stepFromUrl)
  const [restoringDraft, setRestoringDraft] = useState(paymentResumeMode)
  const [draftHydrated, setDraftHydrated] = useState(false)

  // Step 1: Schedule
  const [duration, setDuration] = useState(1)
  const [bookableDates, setBookableDates] = useState<string[]>([])
  const [bookableDatesLoading, setBookableDatesLoading] = useState(false)
  const [date, setDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slots, setSlots] = useState<{ start: string; end: string; disabled?: boolean }[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null)

  // Step 2: Your Details
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [addressMode, setAddressMode] = useState<'saved' | 'new'>('new')
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState(MVP_CITY)
  const [postcode, setPostcode] = useState('')
  const [apartmentDetails, setApartmentDetails] = useState('')
  const [accessNotes, setAccessNotes] = useState('')
  const [jobType, setJobType] = useState<(typeof JOB_TYPE_OPTIONS)[number]['value'] | ''>('')
  const [bedrooms, setBedrooms] = useState('')
  const [bathrooms, setBathrooms] = useState('')
  const [propertyCondition, setPropertyCondition] = useState<(typeof PROPERTY_CONDITION_OPTIONS)[number]['value'] | ''>('')
  const [suppliesProvider, setSuppliesProvider] = useState<(typeof SUPPLIES_OPTIONS)[number]['value'] | ''>('')
  const [notes, setNotes] = useState('')
  const [notesValidationWarning, setNotesValidationWarning] = useState(false)
  const [jobPhotos, setJobPhotos] = useState<File[]>([])
  const [saveAddressForLater, setSaveAddressForLater] = useState(false)
  const [jobPhotoPreviewUrls, setJobPhotoPreviewUrls] = useState<string[]>([])

  // Step 3: Payment
  const [booking, setBooking] = useState<BookingRead | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [nextStepLoading, setNextStepLoading] = useState(false)
  const [cancelRequestLoading, setCancelRequestLoading] = useState(false)
  const [cancelRequestConfirmOpen, setCancelRequestConfirmOpen] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false)
  const [verifyingPhoneOtp, setVerifyingPhoneOtp] = useState(false)
  const [phoneOtpCode, setPhoneOtpCode] = useState('')
  const [showPhoneOtpEntry, setShowPhoneOtpEntry] = useState(false)
  const [transportAgreementConfirmed, setTransportAgreementConfirmed] = useState(false)
  const [suppliesAgreementConfirmed, setSuppliesAgreementConfirmed] = useState(false)
  const [draftSaveState, setDraftSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const hasHydratedDraftRef = useRef(false)
  const draftAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slotsRequestSeqRef = useRef(0)
  const datesRequestSeqRef = useRef(0)
  const draftRevisionRef = useRef(0)
  const latestDraftUpdatedAtRef = useRef('')

  function draftStorageKey() {
    return `booking_flow_draft_v${BOOKING_FLOW_DRAFT_VERSION}:${cleanerId}`
  }

  function readLocalDraft(): BookingFlowDraft | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(draftStorageKey())
      if (!raw) return null
      const parsed = JSON.parse(raw) as unknown
      const normalized = normalizeFlowDraftPayload(parsed)
      if (!normalized || normalized.version !== BOOKING_FLOW_DRAFT_VERSION) return null
      return normalized
    } catch {
      return null
    }
  }

  function writeLocalDraft(draft: BookingFlowDraft) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(draftStorageKey(), JSON.stringify(draft))
    } catch {
      // ignore quota or private mode errors
    }
  }

  function clearLocalDraft() {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(draftStorageKey())
    } catch {
      // ignore
    }
  }

  function navigateToStep(nextStep: number, options?: { dropResumeParams?: boolean; push?: boolean }) {
    const safeStep = Math.min(Math.max(nextStep, 1), 4)
    const qs = new URLSearchParams(searchParams.toString())
    qs.set('step', String(safeStep))
    qs.delete('reset')
    qs.delete('fresh')
    if (options?.dropResumeParams) {
      qs.delete('continue')
      qs.delete('bookingId')
    }
    const nextUrl = `/client/book/${cleanerId}${qs.toString() ? `?${qs.toString()}` : ''}`
    if (options?.push) {
      router.push(nextUrl)
    } else {
      router.replace(nextUrl)
    }
    setStep(safeStep)
  }

  function getDateKeyInAppTimezone(value: string): string {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ''
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(parsed)
  }

  function clearSessionDraft() {
    clearLocalDraft()
    bookingsApi.clearFlowDraft(cleanerId).catch(() => null)
  }

  useEffect(() => {
    setStep((prev) => (prev === stepFromUrl ? prev : stepFromUrl))
  }, [stepFromUrl])

  useEffect(() => {
    if (cleaner?.cleaning_supplies === 'client_supplies' && suppliesProvider !== 'client_provides') {
      setSuppliesProvider('client_provides')
    }
  }, [cleaner?.cleaning_supplies, suppliesProvider])

  async function initializePaymentIntentForBooking(bookingId: string) {
    const intentRes = await paymentsApi.createIntent(bookingId)
    const secret = intentRes.data?.client_secret ?? null
    if (!secret) {
      throw new Error('Unable to initialise card authorisation for this booking. Please try again.')
    }
    setClientSecret(secret)
  }

  async function resumeExistingBooking(bookingId: string, restoredDate: string, restoredSlot: string, restoredDuration: number) {
    const restoredBooking = (await bookingsApi.getById(bookingId)).data
    if (!restoredBooking) return

    if (restoredDate && restoredSlot) {
      const slotList = await availabilityApi.getSlots(cleanerId, restoredDate, restoredDuration || 1)
      const restoredSlotMs = new Date(restoredSlot).getTime()
      const stillAvailable = (slotList.data ?? []).some((slot) => {
        const slotIso = normalizeToIsoDatetime(slot.start)
        return slotIso && new Date(slotIso).getTime() === restoredSlotMs && !slot.disabled
      })
      if (!stillAvailable) {
        toast.error('This time is no longer available. Please choose another time.')
        setBooking(null)
        setClientSecret(null)
        navigateToStep(1, { dropResumeParams: true })
        setSelectedSlot('')
        return
      }
    }

    setBooking(restoredBooking)
    if (isPaymentAuthorizedStatus(restoredBooking.payment?.status)) {
      clearSessionDraft()
      navigateToStep(4, { dropResumeParams: true })
      return
    }

    try {
      await initializePaymentIntentForBooking(restoredBooking.id)
      const latest = await bookingsApi.getById(restoredBooking.id)
      if (latest.data) {
        setBooking(latest.data)
      }
      navigateToStep(3)
      return
    } catch (err: any) {
      setClientSecret(null)
      navigateToStep(3)
      toast.error(err?.message ?? 'Unable to resume payment right now. Please try again.')
      return
    }

  }

  function buildSessionDraft(): BookingFlowDraft {
    const nextRevision = draftRevisionRef.current + 1
    draftRevisionRef.current = nextRevision
    const updatedAt = new Date().toISOString()
    latestDraftUpdatedAtRef.current = updatedAt
    return {
      version: BOOKING_FLOW_DRAFT_VERSION,
      revision: nextRevision,
      updatedAt,
      step,
      duration,
      date,
      selectedSlot,
      bookingId: booking?.id ?? '',
    }
  }

  function hydrateFromDraftPayload(parsed: BookingFlowDraft) {
    draftRevisionRef.current = Math.max(draftRevisionRef.current, Number(parsed.revision || 0))
    latestDraftUpdatedAtRef.current = parsed.updatedAt || latestDraftUpdatedAtRef.current
    const restoredSlot = normalizeToIsoDatetime(parsed.selectedSlot || '') ?? ''
    const restoredDate = parsed.date || (restoredSlot ? getDateKeyInAppTimezone(restoredSlot) : '')

    setDuration(parsed.duration || 1)
    setDate(restoredDate)
    setSelectedSlot(restoredSlot)
  }

  async function persistFlowDraft(lastStep: number, bookingId?: string) {
    const snapshot = buildSessionDraft()
    setDraftSaveState('saving')
    writeLocalDraft(snapshot)
    const normalizedSlot = normalizeToIsoDatetime(snapshot.selectedSlot || '')
    try {
      const response = await bookingsApi.saveFlowDraft({
      cleaner_id: cleanerId,
      booking_id: (bookingId ?? snapshot.bookingId) || undefined,
      last_step: lastStep,
      duration_hours: snapshot.duration,
      selected_date: snapshot.date || undefined,
      selected_slot: normalizedSlot || undefined,
      payload: {
        ...snapshot,
        selectedSlot: normalizedSlot || '',
      },
    })
      setDraftSaveState('saved')
      return response
    } catch (error) {
      setDraftSaveState('error')
      throw error
    }
  }

  function buildFlowDraftBody(lastStep: number, bookingId?: string) {
    const snapshot = buildSessionDraft()
    writeLocalDraft(snapshot)
    const normalizedSlot = normalizeToIsoDatetime(snapshot.selectedSlot || '')
    return {
      cleaner_id: cleanerId,
      booking_id: (bookingId ?? snapshot.bookingId) || undefined,
      last_step: lastStep,
      duration_hours: snapshot.duration,
      selected_date: snapshot.date || undefined,
      selected_slot: normalizedSlot || undefined,
      payload: {
        ...snapshot,
        selectedSlot: normalizedSlot || '',
      },
    }
  }

  function persistFlowDraftOnHide(lastStep: number, bookingId?: string) {
    if (typeof window === 'undefined') return
    if (step > 3) return
    const body = buildFlowDraftBody(lastStep, bookingId)
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([JSON.stringify(body)], { type: 'application/json' })
        navigator.sendBeacon('/api/v1/bookings/draft', blob)
        return
      }
    } catch {
      // fallback below
    }
    fetch('/api/v1/bookings/draft', {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)
  }

  async function refreshVerificationStatus() {
    try {
      const clientRes = await clientsApi.me().catch(() => null)
      const nextEmailVerified = Boolean((clientRes as any)?.data?.user?.email_confirmed_at)
      const nextPhoneVerified = Boolean((clientRes as any)?.data?.user?.phone_verified_at)
      setEmailVerified(nextEmailVerified)
      setPhoneVerified(nextPhoneVerified)
      return { emailVerified: nextEmailVerified, phoneVerified: nextPhoneVerified }
    } catch {
      // keep current values if auth refresh fails
      return { emailVerified, phoneVerified }
    }
  }

  async function sendPhoneVerificationOtpInline() {
    if (!phone.trim()) {
      toast.error('Enter your phone number first.')
      return
    }
    setSendingPhoneOtp(true)
    setShowPhoneOtpEntry(true)
    try {
      await clientsApi.updateMe({ phone: phone.trim() })
      await phoneVerificationApi.sendCode(phone.trim())
      toast.success('Verification code sent by SMS.')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send verification code.')
    } finally {
      setSendingPhoneOtp(false)
    }
  }

  async function verifyPhoneOtpInline() {
    if (!phone.trim()) {
      toast.error('Phone number is required.')
      return
    }
    if (!phoneOtpCode.trim()) {
      toast.error('Enter the verification code.')
      return
    }
    setVerifyingPhoneOtp(true)
    try {
      await phoneVerificationApi.verifyCode(phone.trim(), phoneOtpCode.trim())
      await refreshVerificationStatus()
      setPhoneOtpCode('')
      toast.success('Phone verified.')
    } catch (err: any) {
      toast.error(err.message ?? 'Invalid verification code.')
    } finally {
      setVerifyingPhoneOtp(false)
    }
  }

  // Load cleaner + client profile
  useEffect(() => {
    Promise.all([
      cleanersApi.getById(cleanerId),
      clientsApi.me().catch(() => null),
      clientsApi.listAddresses().catch(() => null),
    ])
      .then(([cleanerRes, clientRes, addressRes]) => {
        setCleaner(cleanerRes.data ?? null)
        const cp = (clientRes as any)?.data ?? null
        const cpAny = (cp ?? {}) as any
        const user = cpAny.user ?? {}
        const addresses = (addressRes as any)?.data ?? []
        const canApplyDefaults = !hasHydratedDraftRef.current
        setClientProfile(cp)
        setSavedAddresses(addresses)

        // Autofill from client profile
        if (cp && canApplyDefaults) {
          if (user?.name) {
            const parts = user.name.trim().split(' ')
            setFirstName(parts[0] ?? '')
            setLastName(parts.slice(1).join(' '))
          }
          if (user?.email) setEmail(user.email)
          if (user?.phone) setPhone(user.phone)
          const defaultAddressLine = (cpAny.default_address ?? cpAny.defaultAddress ?? '').trim()
          const defaultCity = (cpAny.default_city ?? cpAny.defaultCity ?? '').trim() || MVP_CITY
          const defaultPostcode = (cpAny.default_postcode ?? cpAny.defaultPostcode ?? '').trim()
          if (defaultAddressLine) setAddress(defaultAddressLine)
          setCity(defaultCity)
          if (defaultPostcode) setPostcode(defaultPostcode)
          if (defaultAddressLine || defaultCity || defaultPostcode) {
            setAddressMode('saved')
          }
        }
        if (addresses.length > 0 && canApplyDefaults) {
          const defaultAddress = addresses.find((entry: ClientAddressRead) => entry.is_default) ?? addresses[0]
          setAddressMode('saved')
          setSelectedAddressId(defaultAddress.id)
          setAddress(defaultAddress.address_line1)
          setCity(MVP_CITY)
          setPostcode(normalizePostcodeInput(defaultAddress.postcode))
          setApartmentDetails(defaultAddress.apartment_details ?? '')
          setAccessNotes(defaultAddress.access_notes ?? '')
        }
        setEmailVerified(Boolean(user?.email_confirmed_at))
        setPhoneVerified(Boolean(user?.phone_verified_at))
        resetLoadError(`client-book-flow-${cleanerId}`)
      })
      .catch(() => reportLoadError(`client-book-flow-${cleanerId}`, 'Failed to load data'))
      .finally(() => { setLoading(false) })
  }, [cleanerId])

  useEffect(() => {
    if (loading || hasHydratedDraftRef.current) return
    hasHydratedDraftRef.current = true

    if (resetDraft) {
      clearSessionDraft()
      navigateToStep(1, { dropResumeParams: true })
      setRestoringDraft(false)
      setDraftHydrated(true)
      return
    }

    ;(async () => {
      try {
        const localDraft = readLocalDraft()
        const serverDraft = (await bookingsApi.getFlowDraft(cleanerId)).data
        const serverDraftRecord = (serverDraft ?? null) as Record<string, any> | null
        const normalizedServerPayload = normalizeFlowDraftPayload(serverDraftRecord?.payload, serverDraftRecord)
        const normalizedPayload = (() => {
          if (!normalizedServerPayload) return localDraft
          if (!localDraft) return normalizedServerPayload
          const serverTs = parseDraftTimestamp(normalizedServerPayload.updatedAt)
          const localTs = parseDraftTimestamp(localDraft.updatedAt)
          if (serverTs === localTs) {
            return Number(normalizedServerPayload.revision || 0) >= Number(localDraft.revision || 0)
              ? normalizedServerPayload
              : localDraft
          }
          return serverTs >= localTs ? normalizedServerPayload : localDraft
        })()

        if (continueDraft && continueBookingId) {
          if (normalizedPayload && normalizedPayload.version === BOOKING_FLOW_DRAFT_VERSION) {
            hydrateFromDraftPayload(normalizedPayload)
            writeLocalDraft(normalizedPayload)
          }
          const fallbackSlot = normalizeToIsoDatetime(normalizedPayload?.selectedSlot || '') ?? ''
          const fallbackDate = normalizedPayload?.date || (fallbackSlot ? getDateKeyInAppTimezone(fallbackSlot) : '')
          const fallbackDuration = Number(normalizedPayload?.duration || 1)
          await resumeExistingBooking(continueBookingId, fallbackDate, fallbackSlot, fallbackDuration)
          setRestoringDraft(false)
          setDraftHydrated(true)
          return
        }

        if (!normalizedPayload || normalizedPayload.version !== BOOKING_FLOW_DRAFT_VERSION) {
          setRestoringDraft(false)
          setDraftHydrated(true)
          return
        }

        hydrateFromDraftPayload(normalizedPayload)
        writeLocalDraft(normalizedPayload)
        const restoredStep = Math.min(
          Math.max(
            Number(readKey(serverDraftRecord, 'lastStep') || normalizedPayload.step || 1),
            1,
          ),
          3,
        )
        const restoredBookingId = String(readKey(serverDraftRecord, 'bookingId') ?? normalizedPayload.bookingId ?? '').trim()
        if (restoredStep >= 3 && restoredBookingId) {
          await resumeExistingBooking(
            restoredBookingId,
            normalizedPayload.date || '',
            normalizeToIsoDatetime(normalizedPayload.selectedSlot || '') ?? '',
            Number(normalizedPayload.duration || 1),
          )
        } else {
          navigateToStep(restoredStep === 3 ? 2 : restoredStep)
        }
      } catch {
        navigateToStep(1, { dropResumeParams: true })
      } finally {
        setRestoringDraft(false)
        setDraftHydrated(true)
      }
    })()
  }, [loading, continueDraft, continueBookingId, resetDraft, cleanerId])

  useEffect(() => {
    function onFocus() {
      refreshVerificationStatus().catch(() => null)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Fetch available slots when date or duration changes
  useEffect(() => {
    if (!date || !cleanerId) return
    const requestSeq = ++slotsRequestSeqRef.current
    setSlotsLoading(true)
    availabilityApi.getSlots(cleanerId, date, duration)
      .then((r) => {
        if (requestSeq !== slotsRequestSeqRef.current) return
        const nextSlots = r.data ?? []
        setSlots(nextSlots)
        if (!selectedSlot) return
        const normalizedSelected = normalizeToIsoDatetime(selectedSlot)
        const stillAvailable = nextSlots.some((slot) => {
          const normalizedSlot = normalizeToIsoDatetime(slot.start)
          return normalizedSlot && normalizedSelected && normalizedSlot === normalizedSelected && !slot.disabled
        })
        if (!stillAvailable && step <= 1) {
          setSelectedSlot('')
          if (normalizedSelected) {
            toast.error('This time is no longer available. Please choose another time.')
          }
        }
      })
      .catch(() => {
        if (requestSeq !== slotsRequestSeqRef.current) return
        setSlots([])
      })
      .finally(() => {
        if (requestSeq !== slotsRequestSeqRef.current) return
        setSlotsLoading(false)
      })
  }, [date, duration, cleanerId, selectedSlot, step])

  useEffect(() => {
    if (!cleanerId) return
    const requestSeq = ++datesRequestSeqRef.current
    setBookableDatesLoading(true)
    setBookableDates([])
    availabilityApi.getBookableDates(cleanerId, duration, 28)
      .then((r) => {
        if (requestSeq !== datesRequestSeqRef.current) return
        const nextDates = r.data ?? []
        setBookableDates(nextDates)
        if (date && !nextDates.includes(date) && step <= 1) {
          setDate('')
          setSelectedSlot('')
          if (selectedSlot) {
            toast.error('This time is no longer available. Please choose another time.')
          }
        }
      })
      .catch(() => {
        if (requestSeq !== datesRequestSeqRef.current) return
        setBookableDates([])
      })
      .finally(() => {
        if (requestSeq !== datesRequestSeqRef.current) return
        setBookableDatesLoading(false)
      })
  }, [cleanerId, duration, date, step, selectedSlot])

  // Fetch price breakdown when duration changes
  useEffect(() => {
    if (!cleanerId) return
    bookingsApi.previewPrice(cleanerId, duration)
      .then(r => setBreakdown(r.data ?? null))
      .catch(() => { })
  }, [duration, cleanerId])

  useEffect(() => {
    const nextPreviewUrls = jobPhotos.map((file) => URL.createObjectURL(file))
    setJobPhotoPreviewUrls(nextPreviewUrls)
    return () => {
      nextPreviewUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [jobPhotos])

  useEffect(() => {
    if (loading || !draftHydrated) return
    if (step > 3) return

    if (draftAutosaveTimerRef.current) {
      clearTimeout(draftAutosaveTimerRef.current)
    }

    const persistedStep = booking?.id && step >= 3 ? 3 : 1
    draftAutosaveTimerRef.current = setTimeout(() => {
      persistFlowDraft(persistedStep, booking?.id ?? undefined).catch((error) => {
        const message = error instanceof Error ? error.message : 'Draft save failed'
        console.error('[booking-flow][autosave] failed', {
          cleanerId,
          step,
          persistedStep,
          date,
          selectedSlot,
          duration,
          bookingId: booking?.id ?? null,
          message,
        })
      })
    }, 200)

    return () => {
      if (draftAutosaveTimerRef.current) {
        clearTimeout(draftAutosaveTimerRef.current)
      }
    }
  }, [
    loading,
    draftHydrated,
    step,
    duration,
    date,
    selectedSlot,
    booking?.id,
  ])

  useEffect(() => {
    if (loading || !draftHydrated) return
    const persistedStep = booking?.id && step >= 3 ? 3 : 1
    function flush() {
      persistFlowDraftOnHide(persistedStep, booking?.id ?? undefined)
    }
    function onBeforeUnload() {
      flush()
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [loading, draftHydrated, step, booking?.id])

  const estimatedCost = useMemo(() => {
    if (!cleaner) return 0
    return roundMoney(cleaner.hourly_rate * duration)
  }, [cleaner, duration])
  const sidebarDuration = step === 3 && booking ? Number(booking.duration_hours) : duration
  const sidebarBreakdown = step === 3 && booking
    ? {
        hourly_rate: Number(booking.hourly_rate),
        duration_hours: Number(booking.duration_hours),
        subtotal: Number(booking.subtotal ?? (booking.total_amount - booking.platform_fee)),
        platform_fee_pct: Number(booking.platform_fee_pct ?? 10),
        platform_fee: Number(booking.platform_fee),
        cleaner_payout: Number(booking.cleaner_payout),
        total_amount: Number(booking.total_amount),
      }
    : breakdown
  const sidebarSelectedSlot = step === 3 && booking ? String(booking.scheduled_start) : selectedSlot
  const sidebarDate = step === 3 && booking
    ? getDateKeyInAppTimezone(String(booking.scheduled_start))
    : date

  const missingAccountItems = useMemo(() => {
    const issues: string[] = []
    if (!emailVerified) issues.push('Verify email')
    if (!phoneVerified) issues.push('Verify phone number')
    if (!address.trim() || !city.trim() || !postcode.trim()) issues.push('Add service address')
    return issues
  }, [emailVerified, phoneVerified, address, city, postcode])

  const missingProfileRequiredItems = useMemo(() => {
    const issues: string[] = []
    if (!firstName.trim()) issues.push('First name')
    if (!lastName.trim()) issues.push('Last name')
    if (!email.trim()) issues.push('Email')
    if (!phone.trim()) issues.push('Phone number')
    return issues
  }, [firstName, lastName, email, phone])

  function applySavedAddress(addressId: string) {
    const selected = savedAddresses.find((entry) => entry.id === addressId)
    if (!selected) return
    setSelectedAddressId(addressId)
    setAddress(selected.address_line1)
      setCity(MVP_CITY)
      setPostcode(normalizePostcodeInput(selected.postcode))
    setApartmentDetails(selected.apartment_details ?? '')
    setAccessNotes(selected.access_notes ?? '')
  }

  function switchToSavedAddressMode() {
    setAddressMode('saved')
    if (selectedAddressId) {
      applySavedAddress(selectedAddressId)
      return
    }
    const fallback = savedAddresses.find((entry) => entry.is_default) ?? savedAddresses[0]
    if (fallback) {
      applySavedAddress(fallback.id)
      return
    }
    const cpAny = (clientProfile ?? {}) as any
    const defaultAddressLine = (cpAny.default_address ?? cpAny.defaultAddress ?? '').trim()
    const defaultCity = (cpAny.default_city ?? cpAny.defaultCity ?? '').trim() || MVP_CITY
    const defaultPostcode = (cpAny.default_postcode ?? cpAny.defaultPostcode ?? '').trim()
    if (defaultAddressLine || defaultCity || defaultPostcode) {
      setAddress(defaultAddressLine)
      setCity(MVP_CITY)
      setPostcode(normalizePostcodeInput(defaultPostcode))
    }
  }

  function switchToNewAddressMode() {
    setAddressMode('new')
    setSelectedAddressId('')
    setAddress('')
    setCity(MVP_CITY)
    setPostcode('')
    setApartmentDetails('')
    setAccessNotes('')
  }

  useEffect(() => {
    if (addressMode !== 'saved') return
    if (savedAddresses.length !== 1) return
    const only = savedAddresses[0]
    if (!only) return
    if (selectedAddressId === only.id) return
    applySavedAddress(only.id)
  }, [addressMode, savedAddresses, selectedAddressId])

  function mergeJobPhotos(selectedFiles: File[]) {
    const merged = [...jobPhotos]
    for (const file of selectedFiles) {
      const exists = merged.some(
        (item) =>
          item.name === file.name &&
          item.size === file.size &&
          item.lastModified === file.lastModified,
      )
      if (exists) continue
      if (merged.length >= MAX_JOB_PHOTOS) break
      merged.push(file)
    }
    setJobPhotos(merged)
  }

  function removeJobPhoto(index: number) {
    const nextPhotos = jobPhotos.filter((_, i) => i !== index)
    setJobPhotos(nextPhotos)
  }

  async function uploadJobPhotos(files: File[]) {
    const uploadedUrls: string[] = []
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/v1/upload/booking-photos', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const json = await response.json().catch(() => ({ success: false, message: 'Failed to upload photo' }))
      if (!response.ok || !json?.success || !json?.data?.url) {
        throw new Error(json?.message ?? `Failed to upload ${file.name}`)
      }
      uploadedUrls.push(json.data.url)
    }
    return uploadedUrls
  }

  async function assertSelectedSlotStillAvailable() {
    if (!date || !selectedSlot) return
    const normalizedSelectedSlot = normalizeToIsoDatetime(selectedSlot)
    if (!normalizedSelectedSlot) {
      throw new Error('Selected time is missing or invalid. Please go back to Step 1 and choose a time again.')
    }
    const selectedSlotMs = new Date(normalizedSelectedSlot).getTime()
    const slotList = await availabilityApi.getSlots(cleanerId, date, duration)
    const stillAvailable = (slotList.data ?? []).some((slot) => {
      const slotIso = normalizeToIsoDatetime(slot.start)
      return slotIso && new Date(slotIso).getTime() === selectedSlotMs && !slot.disabled
    })
    if (!stillAvailable) {
      throw new Error('This time is no longer available. Please choose another time.')
    }
  }

  function buildSpecialInstructions(photoUrls: string[]) {
    const jobTypeMeta = JOB_TYPE_OPTIONS.find((option) => option.value === jobType)
    const conditionMeta = PROPERTY_CONDITION_OPTIONS.find((option) => option.value === propertyCondition)
    const selectedSuppliesProvider = cleaner?.cleaning_supplies === 'client_supplies' ? 'client_provides' : suppliesProvider
    const suppliesMeta = SUPPLIES_OPTIONS.find((option) => option.value === selectedSuppliesProvider)
    const transportSnapshot =
      cleaner?.transport_mode === 'own_car'
        ? 'Own transport'
        : cleaner?.transport_mode === 'bus_walk'
          ? 'Bus / Walk'
          : cleaner?.transport_mode === 'requires_pickup'
            ? 'Requires pickup/drop-off'
            : 'Not set'
    const pickupLocationSnapshot =
      cleaner?.transport_mode === 'requires_pickup'
        ? pickupFullLabel((cleaner as any)?.transport_pickup_location ?? '')
        : ''
    const lines = [
      `Job type: ${jobTypeMeta?.label ?? 'Not provided'}`,
      `Bedrooms: ${bedrooms}`,
      `Bathrooms: ${bathrooms}`,
      `Property condition: ${conditionMeta?.label ?? 'Not provided'}`,
      `Cleaning supplies: ${suppliesMeta?.label ?? 'Not provided'}`,
      `Cleaner transport: ${transportSnapshot}`,
      ...(pickupLocationSnapshot ? [`Pickup location snapshot: ${pickupLocationSnapshot}`] : []),
      `What needs to be cleaned: ${notes.trim()}`,
    ]
    if (photoUrls.length > 0) {
      lines.push(`Job photos (${photoUrls.length}): ${photoUrls.join(', ')}`)
    }
    let payload = lines.join('\n')
    if (payload.length <= MAX_SPECIAL_INSTRUCTIONS_CHARS) return payload

    // Keep payload within API limits by compacting photo metadata first.
    if (photoUrls.length > 0) {
      const compactLines = [
        ...lines.filter((line) => !line.startsWith('Job photos')),
        `Job photos uploaded: ${photoUrls.length}.`,
      ]
      payload = compactLines.join('\n')
    }

    if (payload.length > MAX_SPECIAL_INSTRUCTIONS_CHARS) {
      payload = payload.slice(0, MAX_SPECIAL_INSTRUCTIONS_CHARS)
    }
    return payload
  }

  // Navigation
  async function goNext() {
    if (step === 1) {
      if (cleanerRequiresPickup && !transportAgreementConfirmed) {
        toast.error('Please confirm pickup and drop-off arrangement before proceeding.')
        return
      }
      if (cleanerNeedsClientSupplies && !suppliesAgreementConfirmed) {
        toast.error('Please confirm cleaning supplies arrangement before proceeding.')
        return
      }
      if (!date) { toast.error('Please select a date.'); return }
      if (!selectedSlot) { toast.error('Please select a time slot.'); return }
      setNextStepLoading(true)
      try {
        const saved = await persistFlowDraft(1)
        const savedDraft = saved.data as any
        const savedSlot = String(
          savedDraft?.selectedSlot
          ?? savedDraft?.selected_slot
          ?? savedDraft?.payload?.selectedSlot
          ?? savedDraft?.payload?.selected_slot
          ?? '',
        ).trim()
        if (!savedSlot) {
          throw new Error('Draft did not persist selected time. Please try again.')
        }
      } catch (err: any) {
        console.error('Step 1 draft save failed', err)
        setNextStepLoading(false)
        toast.error(err?.message ?? 'Unable to save draft right now. Please try again.')
        return
      }
      navigateToStep(2)
      setNextStepLoading(false)
    } else if (step === 2) {
      const normalizedSelectedSlot = normalizeToIsoDatetime(selectedSlot)
      if (!normalizedSelectedSlot) {
        toast.error('Selected time is missing. Please go back to Step 1 and choose a time again.')
        navigateToStep(1)
        return
      }
      if (missingProfileRequiredItems.length > 0) {
        toast.error('Please complete your name, email, and phone number to continue.')
        return
      }
      if (addressMode === 'saved' && !selectedAddressId) { toast.error('Select a saved address or add a new one.'); return }
      if (!address.trim()) { toast.error('Service address is required.'); return }
      if (!postcode.trim()) { toast.error('Postcode is required.'); return }
      if (!/^\d{4}$/.test(normalizePostcodeInput(postcode))) { toast.error('Postcode must be 4 digits.'); return }
      if (!jobType) { toast.error('Please select what type of clean this is.'); return }
      if (!bedrooms) { toast.error('Please select bedrooms.'); return }
      if (!bathrooms) { toast.error('Please select bathrooms.'); return }
      if (!propertyCondition) { toast.error('Please select the current condition of the property.'); return }
      if (!effectiveSuppliesProvider) { toast.error('Please select who will provide cleaning supplies.'); return }
      if (!notes.trim()) {
        setNotesValidationWarning(true)
        toast.error('Please add a short description of what needs to be cleaned')
        return
      }
      setNotesValidationWarning(false)
      if (notes.trim().length < NOTES_MIN_CHARS) {
        toast.error(`Please describe what needs to be cleaned in at least ${NOTES_MIN_CHARS} characters.`)
        return
      }
      if (jobPhotos.length === 1) {
        toast.error('Please upload at least 2 photos if you want to add photos.')
        return
      }
      if (jobPhotos.length > MAX_JOB_PHOTOS) {
        toast.error(`You can upload up to ${MAX_JOB_PHOTOS} photos.`)
        return
      }
      setNextStepLoading(true)
      await createDraftBookingAndProceed()
      setNextStepLoading(false)
    }
  }

  async function createDraftBookingAndProceed() {
    setSubmitting(true)
    let failureStage: 'slot_recheck' | 'photo_upload' | 'booking_create' | 'payment_intent' = 'slot_recheck'
    try {
      failureStage = 'slot_recheck'
      await assertSelectedSlotStillAvailable()
      const selectedJobType = JOB_TYPE_OPTIONS.find((option) => option.value === jobType)
      if (!selectedJobType) {
        throw new Error('Please select what type of clean this is.')
      }
      const normalizedScheduledStart = normalizeToIsoDatetime(selectedSlot)
      if (!normalizedScheduledStart) {
        throw new Error('Please select a valid time slot.')
      }

      const reusableBooking =
        booking &&
        ['draft', 'pending', 'accepted'].includes(booking.status) &&
        booking.cleaner_id === cleanerId &&
        normalizeToIsoDatetime(booking.scheduled_start) === normalizedScheduledStart &&
        Number(booking.duration_hours) === Number(duration)
          ? booking
          : null

      let uploadedPhotoUrls: string[] = []
      if (!reusableBooking && jobPhotos.length > 0) {
        failureStage = 'photo_upload'
        uploadedPhotoUrls = await uploadJobPhotos(jobPhotos)
      }

      failureStage = 'booking_create'
      const b = reusableBooking ?? (
        await bookingsApi.create({
          cleaner_id: cleanerId,
          service_type: selectedJobType.serviceType,
          address: address.trim(),
          city: city.trim(),
          postcode: normalizePostcodeInput(postcode),
          country: 'CY',
          apartment_details: apartmentDetails.trim() || undefined,
          access_notes: accessNotes.trim() || undefined,
          scheduled_start: normalizedScheduledStart,
          duration_hours: duration,
          special_instructions: buildSpecialInstructions(uploadedPhotoUrls),
        })
      ).data
      if (!b) throw new Error('Failed to create draft booking')
      setBooking(b)
      await persistFlowDraft(3, b.id)

      failureStage = 'payment_intent'
      const intentRes = await paymentsApi.createIntent(b.id)
      const nextClientSecret = intentRes.data?.client_secret ?? null
      if (!nextClientSecret) {
        throw new Error('Unable to initialize card authorization for this booking')
      }
      setClientSecret(nextClientSecret)
      navigateToStep(3)
    } catch (err: any) {
      const rawMessage = String(err?.message ?? '').trim()
      const fallbackByStage: Record<typeof failureStage, string> = {
        slot_recheck: 'Could not re-check slot availability. Please refresh and try again.',
        photo_upload: 'Photo upload failed. Please try again without photos or re-upload them.',
        booking_create: 'Booking draft could not be created. Please try again.',
        payment_intent: 'Booking draft saved, but card authorization setup failed. Please try again.',
      }
      const message =
        rawMessage && rawMessage !== 'Something went wrong. Please try again.'
          ? rawMessage
          : fallbackByStage[failureStage]
      toast.error(message)
      console.error('createDraftBookingAndProceed failed', {
        stage: failureStage,
        cleanerId,
        selectedSlot,
        date,
        duration,
        bookingId: booking?.id ?? null,
        message: rawMessage || null,
      })
      if (String(err?.message ?? '').includes('no longer available')) {
        navigateToStep(1, { dropResumeParams: true })
        setBooking(null)
        setClientSecret(null)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePaymentSuccess() {
    if (!booking) throw new Error('Missing booking context for authorization sync')

    await paymentsApi.syncAuthorization(booking.id)
    if (addressMode === 'new' && saveAddressForLater) {
      try {
        const normalizedPostcode = normalizePostcodeInput(postcode)
        const exists = savedAddresses.some((entry) =>
          entry.address_line1.trim().toLowerCase() === address.trim().toLowerCase()
          && normalizePostcodeInput(entry.postcode) === normalizedPostcode
        )
        if (!exists) {
          if (savedAddresses.length >= MAX_SAVED_ADDRESSES) {
            toast.error("You've reached the maximum number of saved addresses. Please remove an existing address to add a new one.")
          } else {
            await clientsApi.addAddress({
              address_line1: address.trim(),
              city: MVP_CITY,
              postcode: normalizedPostcode,
              country: 'CY',
              apartment_details: apartmentDetails.trim() || undefined,
              access_notes: accessNotes.trim() || undefined,
              is_default: savedAddresses.length === 0,
            })
          }
        }
      } catch {
        // Authorization success should not fail because address save fails.
      }
    }
    const bookingRes = await bookingsApi.getById(booking.id)
    if (bookingRes.data) {
      setBooking(bookingRes.data)
    }
    clearSessionDraft()
    navigateToStep(4, { dropResumeParams: true })
  }

  async function cancelDraftAndRestart() {
    if (!booking) return

    setCancelRequestLoading(true)
    try {
      await bookingsApi.cancel(booking.id, 'Client cancelled draft before payment authorisation')
      clearSessionDraft()
      toast.success('Draft cancelled. You can start a new booking now.')
      setCancelRequestConfirmOpen(false)
      router.push(`/client/book/${cleanerId}?reset=1&step=1`)
    } catch (err: any) {
      toast.error(err?.message ?? 'Unable to cancel this draft right now. Please try again.')
    } finally {
      setCancelRequestLoading(false)
    }
  }

  const isPaymentRequiredLocked =
    step === 3 &&
    Boolean(booking) &&
    ['draft', 'pending'].includes(String(booking?.status ?? '')) &&
    !isPaymentAuthorizedStatus(booking?.payment?.status)

  if (loading || restoringDraft) return <FormPageSkeleton />
  if (!cleaner) return <div className="text-center py-16 text-muted-foreground">Cleaner not found.</div>

  const cleanerName = cleaner.user?.name ?? 'Professional Cleaner'
  const showDeepCleanAdvisory = jobType === 'deep_clean' || jobType === 'move_out_end_of_tenancy'
  const cleanerRequiresPickup = cleaner.transport_mode === 'requires_pickup'
  const cleanerNeedsClientSupplies = cleaner.cleaning_supplies === 'client_supplies'
  const effectiveSuppliesProvider = cleanerNeedsClientSupplies ? 'client_provides' : suppliesProvider
  const bookingSnapshot = booking ? parseBookingSnapshotDetails(booking.special_instructions) : null

  return (
    <>
      <div className="client-book-flow-revamp space-y-7 md:space-y-9">
        <section className="client-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
          <div className="client-stage__media" aria-hidden="true" />
          <div className="client-stage__grain" aria-hidden="true" />

          <div className="relative z-10 grid gap-3 px-5 py-3 sm:px-6 sm:py-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-8 lg:py-4">
            <div className="animate-stage-up space-y-4">
              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                MaidHive Booking Flow
              </p>
              <h1 className={`${displayFont.className} text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl`}>
                Book {cleanerName}
              </h1>
              <p className="max-w-xl text-sm text-slate-100/90 sm:text-base">
                Select schedule, fill details, authorise payment, and confirm your booking in one guided flow.
              </p>
            </div>

            <div className="animate-stage-up delay-120">
              <div className="ml-auto w-full max-w-sm rounded-3xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm">
                <p className={`${monoFont.className} text-[0.62rem] uppercase tracking-[0.18em] text-cyan-200/90`}>
                  Current Step
                </p>
                <p className={`${displayFont.className} mt-1 text-3xl font-bold tracking-[-0.02em] text-white`}>
                  {step} / 4
                </p>
                <p className="mt-1 text-sm text-white/80">
                  {step === 1 ? 'Select Date & Time' : step === 2 ? 'Address & Job Details' : step === 3 ? 'Payment' : 'Confirmation'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl">
          <div className="mb-5">
            {!isPaymentRequiredLocked && (
              <button
                onClick={() => (
                  step > 1
                    ? navigateToStep(step - 1)
                    : router.push(openedFromBookings ? '/client/bookings' : '/client/cleaners')
                )}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" /> {step > 1 ? 'Previous' : openedFromBookings ? 'Back to bookings' : 'Back to all cleaners'}
              </button>
            )}
          </div>
          <StepIndicator current={step} />
          {step <= 3 && (
            <p className="mb-3 text-right text-xs text-slate-500">
              {draftSaveState === 'saving' ? 'Saving draft...' : draftSaveState === 'saved' ? 'Draft saved' : draftSaveState === 'error' ? 'Draft save pending retry' : 'Draft autosave active'}
            </p>
          )}

          <div className={cn('grid gap-6', step < 4 ? 'xl:grid-cols-[1fr_320px]' : 'max-w-2xl mx-auto w-full')}>
        {/* Main content */}
        <div>
          {/* ── Step 1: Service & Date ─────────────────────────────── */}
          {step === 1 && !isPaymentRequiredLocked && (
            <Card className="rounded-2xl border-slate-200">
              <CardHeader>
                <CardTitle>Select Date &amp; Time</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-3 md:gap-0 md:divide-x md:divide-slate-200 md:p-0">
                  <div className="md:px-5 md:py-4">
                    <Label className="text-sm font-semibold text-slate-700">Duration</Label>
                    <Select value={String(duration)} onChange={e => setDuration(Number(e.target.value))} className="mt-1">
                      {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} hour{d !== 1 ? 's' : ''}</option>)}
                    </Select>
                    <p className="mt-1 text-xs text-slate-500">Most standard cleans require 2-3 hours.</p>
                  </div>
                  <div className="md:px-5 md:py-4">
                    <Label className="text-sm font-semibold text-slate-700">Hourly Rate</Label>
                    <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(cleaner.hourly_rate)}<span className="text-sm font-normal text-slate-500">/hr</span></p>
                  </div>
                  <div className="md:px-5 md:py-4">
                    <Label className="text-sm font-semibold text-slate-700">Total Price</Label>
                    <p className="mt-1 text-lg font-bold text-primary">
                      {formatCurrency(breakdown?.total_amount ?? roundMoney(estimatedCost + calculatePlatformFee(estimatedCost)))}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Includes secure booking &amp; support fee.</p>
                  </div>
                </div>

                {cleanerRequiresPickup && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <p>This cleaner requires pickup and drop-off. You will need to arrange transport to and from their pickup location.</p>
                    {(cleaner as any).transport_pickup_location && (
                      <p className="mt-1 text-xs font-medium text-amber-900">
                        Requires pick-up/drop-off: {pickupFullLabel((cleaner as any).transport_pickup_location)}
                      </p>
                    )}
                    <label className="mt-2 inline-flex items-start gap-2 text-xs font-medium text-amber-900">
                      <input
                        type="checkbox"
                        checked={transportAgreementConfirmed}
                        onChange={(event) => setTransportAgreementConfirmed(event.target.checked)}
                      />
                      I confirm I will provide pickup and drop-off for this booking.
                    </label>
                  </div>
                )}

                {cleanerNeedsClientSupplies && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <p>This cleaner does not bring cleaning supplies. You will need to provide all required supplies.</p>
                    <label className="mt-2 inline-flex items-start gap-2 text-xs font-medium text-amber-900">
                      <input
                        type="checkbox"
                        checked={suppliesAgreementConfirmed}
                        onChange={(event) => setSuppliesAgreementConfirmed(event.target.checked)}
                      />
                      I confirm I will provide cleaning supplies.
                    </label>
                  </div>
                )}

                {/* Date picker */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Select Date</Label>
                  <BookableCalendar
                    className="mt-2"
                    availableDates={bookableDates}
                    selectedDate={date}
                    onSelectDate={setDate}
                    daysAhead={45}
                  />
                  {bookableDatesLoading && (
                    <p className="mt-2 text-xs text-muted-foreground">Loading available dates...</p>
                  )}
                  {date && (
                    <p className="mt-2 text-xs text-slate-600">
                      Selected: {new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        timeZone: APP_TIMEZONE,
                      })}
                    </p>
                  )}
                  {!bookableDatesLoading && bookableDates.length === 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">No available dates found for this duration.</p>
                  )}
                </div>

                {!date && (
                  <p className="text-sm text-slate-500">Select a date to view available time slots.</p>
                )}

                {/* Time slots */}
                {date && (
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Select time of day</Label>
                    <p className="mb-2 text-xs text-slate-500">
                      Only available time slots that fit your selected duration are shown.
                    </p>
                    {slotsLoading ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="h-11 rounded-xl bg-slate-100 animate-pulse" />
                        ))}
                      </div>
                    ) : slots.length === 0 ? (
                      <p className="text-sm text-slate-500">No available slots on this date.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {slots.map(slot => {
                          const time = new Date(slot.start).toLocaleTimeString('en-IE', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: APP_TIMEZONE })
                          const isDisabled = !!slot.disabled
                          const isSelected = selectedSlot === slot.start
                          return (
                            <button
                              key={slot.start}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => !isDisabled && setSelectedSlot(slot.start)}
                              className={`rounded-xl border py-2.5 text-sm font-medium transition-all ${isDisabled
                                ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-primary text-white border-primary shadow-sm'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-primary/40 hover:-translate-y-0.5'
                                }`}
                            >
                              {time}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-end pt-4">
                  <Button onClick={goNext} loading={nextStepLoading && step === 1} className="gap-2">
                    Save and Next <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step 2: Your Details ───────────────────────────────── */}
          {step === 2 && !isPaymentRequiredLocked && (
            <Card className="rounded-2xl border-slate-200">
              <CardHeader>
                <CardTitle>Address &amp; Job Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm font-semibold">First Name <span className="text-red-500">*</span></Label>
                    <Input required value={firstName} readOnly className="mt-1 bg-slate-50" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Last Name <span className="text-red-500">*</span></Label>
                    <Input required value={lastName} readOnly className="mt-1 bg-slate-50" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Email <span className="text-red-500">*</span></Label>
                    <Input required type="email" value={email} readOnly className="mt-1 bg-slate-50" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Phone Number <span className="text-red-500">*</span></Label>
                    <Input required value={phone} readOnly className="mt-1 bg-slate-50" />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">Contact details are synced from your profile and cannot be changed here.</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => router.push('/client/profile')}>
                      Edit in profile
                    </Button>
                    {missingProfileRequiredItems.length > 0 && (
                      <p className="text-xs text-amber-700">Please complete your name, email, and phone number to continue. Verification happens in the payment step.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <Label className="text-sm font-semibold">Address selection</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        checked={addressMode === 'saved'}
                        onChange={switchToSavedAddressMode}
                        disabled={savedAddresses.length === 0 && !address.trim() && !city.trim() && !postcode.trim()}
                      />
                      Saved Addresses
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        checked={addressMode === 'new'}
                        onChange={switchToNewAddressMode}
                      />
                      Add a new address
                    </label>
                  </div>

                  {addressMode === 'saved' && savedAddresses.length > 1 && (
                    <div>
                      <Label className="text-sm font-semibold">Saved Addresses</Label>
                      <Select value={selectedAddressId} onChange={(e) => applySavedAddress(e.target.value)} className="mt-1">
                        <option value="">Select saved address</option>
                        {savedAddresses.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {(entry.label?.trim() || 'Saved address')} - {entry.address_line1}, {MVP_CITY}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                  {addressMode === 'saved' && savedAddresses.length === 1 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Using saved address: {savedAddresses[0].address_line1}, {MVP_CITY}
                    </div>
                  )}
                  {addressMode === 'saved' && savedAddresses.length === 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Using your saved profile address.
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-semibold">Service Address <span className="text-red-500">*</span></Label>
                    <Input
                      required
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className={`mt-1 ${addressMode === 'saved' ? 'bg-slate-50' : ''}`}
                      placeholder="Street address"
                      readOnly={addressMode === 'saved'}
                    />
                  </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm font-semibold">City <span className="text-red-500">*</span></Label>
                    <Input required value={MVP_CITY} readOnly className="mt-1 bg-slate-50" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Postcode <span className="text-red-500">*</span></Label>
                    <Input
                      required
                      value={postcode}
                      onChange={e => setPostcode(normalizePostcodeInput(e.target.value))}
                      className={`mt-1 ${addressMode === 'saved' ? 'bg-slate-50' : ''}`}
                      placeholder="6010"
                      inputMode="numeric"
                      maxLength={4}
                      readOnly={addressMode === 'saved'}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Your full address is only shared after the cleaner accepts the booking. Before acceptance, cleaners only see an approximate area/location.
                </p>

                  <div>
                    <Label className="text-sm font-semibold">Apartment details</Label>
                    <Input
                      value={apartmentDetails}
                      onChange={e => setApartmentDetails(e.target.value)}
                      className="mt-1"
                      placeholder="Apartment / unit / floor (optional)"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-semibold">Access notes</Label>
                    <Textarea
                      required
                      value={accessNotes}
                      onChange={e => setAccessNotes(e.target.value)}
                      placeholder="Doorbell details, gate code, parking, or entry instructions"
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                  {addressMode === 'new' && (
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={saveAddressForLater}
                          onChange={(event) => setSaveAddressForLater(event.target.checked)}
                        />
                        Save this address for future bookings
                      </label>
                      {savedAddresses.length >= MAX_SAVED_ADDRESSES && (
                        <p className="text-xs text-amber-700">
                          You&apos;ve reached the maximum number of saved addresses. Please remove an existing address to add a new one.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <section className="space-y-5 rounded-xl border border-slate-200 p-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Describe the job</h3>
                    <p className="mt-1 text-sm text-slate-500">Help the cleaner understand the job clearly before accepting</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">What type of clean is this? <span className="text-red-500">*</span></Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {JOB_TYPE_OPTIONS.map((option) => (
                        <label key={option.value} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm text-slate-700">
                          <input
                            type="radio"
                            name="job-type"
                            value={option.value}
                            checked={jobType === option.value}
                            onChange={(event) => setJobType(event.target.value as (typeof JOB_TYPE_OPTIONS)[number]['value'])}
                            className="mt-1"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {showDeepCleanAdvisory && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      Deep and move-out cleans often take significantly longer than regular cleaning. Underestimating time may result in incomplete tasks or cleaners declining the request.
                      <div className="mt-2">
                        <button type="button" onClick={() => navigateToStep(1)} className="text-xs font-semibold text-amber-900 underline">
                          Adjust duration
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Property details <span className="text-red-500">*</span></Label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs font-semibold text-slate-600">Bedrooms</Label>
                        <Select value={bedrooms} onChange={(event) => setBedrooms(event.target.value)} className="mt-1">
                          <option value="">Bedrooms</option>
                          {BEDROOM_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-600">Bathrooms</Label>
                        <Select value={bathrooms} onChange={(event) => setBathrooms(event.target.value)} className="mt-1">
                          <option value="">Bathrooms</option>
                          {BATHROOM_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">What is the current condition of the property? <span className="text-red-500">*</span></Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {PROPERTY_CONDITION_OPTIONS.map((option) => (
                        <label key={option.value} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm text-slate-700">
                          <input
                            type="radio"
                            name="property-condition"
                            value={option.value}
                            checked={propertyCondition === option.value}
                            onChange={(event) => setPropertyCondition(event.target.value as (typeof PROPERTY_CONDITION_OPTIONS)[number]['value'])}
                            className="mt-1"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Who will provide cleaning supplies? <span className="text-red-500">*</span></Label>
                    <div className="grid gap-2">
                      {SUPPLIES_OPTIONS.map((option) => (
                        <label key={option.value} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm text-slate-700">
                          <input
                            type="radio"
                            name="supplies-provider"
                            value={option.value}
                            checked={effectiveSuppliesProvider === option.value}
                            onChange={(event) => setSuppliesProvider(event.target.value as (typeof SUPPLIES_OPTIONS)[number]['value'])}
                            disabled={cleanerNeedsClientSupplies && option.value !== 'client_provides'}
                            className="mt-1"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                    {cleanerNeedsClientSupplies && (
                      <p className="text-xs text-amber-700">This cleaner requires client-provided supplies, so this is locked to: Provided by client.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">What needs to be cleaned? <span className="text-red-500">*</span></Label>
                    <Textarea
                      value={notes}
                      onChange={(event) => {
                        setNotes(event.target.value)
                        if (event.target.value.trim()) {
                          setNotesValidationWarning(false)
                        }
                      }}
                      placeholder="Please list the key areas and tasks clearly (e.g. kitchen deep clean, oven, windows, bathrooms, floors, balcony, etc.)"
                      className="mt-1"
                      rows={4}
                    />
                    <p className="text-xs text-slate-500">
                      If specific tasks are not listed, the cleaner may prioritise based on time available. You can also confirm details with the cleaner when they arrive.
                    </p>
                    {notesValidationWarning && (
                      <p className="text-xs font-medium text-amber-700">Please add a short description of what needs to be cleaned</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Upload photos</Label>
                    <p className="text-xs text-slate-500">Recommended for deep or detailed jobs.</p>
                    {showDeepCleanAdvisory && (
                      <p className="text-xs font-medium text-amber-700">Uploading photos is strongly recommended for these types of jobs.</p>
                    )}
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(event) => {
                        const selectedFiles = Array.from(event.target.files ?? [])
                        mergeJobPhotos(selectedFiles)
                        event.currentTarget.value = ''
                      }}
                      className="mt-1"
                    />
                    {jobPhotos.length > 0 && (
                      <>
                        <p className="text-xs text-slate-500">{jobPhotos.length} photo(s) selected. Upload between 2 and 5 photos.</p>
                        <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-4">
                          {jobPhotos.map((file, idx) => (
                            <div key={`${file.name}-${file.lastModified}-${idx}`} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                              {jobPhotoPreviewUrls[idx] ? (
                                <a
                                  href={jobPhotoPreviewUrls[idx]}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block"
                                  title={file.name}
                                >
                                  <img
                                    src={jobPhotoPreviewUrls[idx]}
                                    alt={file.name}
                                    className="h-20 w-full object-cover"
                                  />
                                </a>
                              ) : (
                                <div className="h-20 w-full bg-slate-100" />
                              )}
                              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                                {jobPhotoPreviewUrls[idx] ? (
                                  <a
                                    href={jobPhotoPreviewUrls[idx]}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex min-w-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                                    title={file.name}
                                  >
                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{file.name}</span>
                                  </a>
                                ) : (
                                  <span className="truncate text-xs text-slate-500" title={file.name}>
                                    {file.name}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeJobPhoto(idx)}
                                  className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                                  aria-label={`Remove ${file.name}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </section>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => navigateToStep(1)}
                    className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" /> Previous
                  </button>
                  <Button onClick={goNext} loading={submitting || (nextStepLoading && step === 2)} className="gap-1.5">
                    Save and Next <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step 3: Payment ────────────────────────────────────── */}
          {step === 3 && booking && (
            <Card className="rounded-2xl border-slate-200">
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {isPaymentRequiredLocked && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    Need to change something? Cancel this draft and start a new booking.
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Saved booking details</p>
                  <div className="mt-2 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                    <p><span className="font-medium">Date/time:</span> {new Date(booking.scheduled_start).toLocaleString('en-IE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: APP_TIMEZONE })}</p>
                    <p><span className="font-medium">Duration:</span> {booking.duration_hours} hour{Number(booking.duration_hours) === 1 ? '' : 's'}</p>
                    <p><span className="font-medium">Address:</span> {booking.address}, {booking.city}, {booking.postcode}</p>
                    <p><span className="font-medium">Job type:</span> {bookingSnapshot?.jobType || 'Not provided'}</p>
                    <p><span className="font-medium">Bedrooms/bathrooms:</span> {bookingSnapshot?.bedrooms || '-'} / {bookingSnapshot?.bathrooms || '-'}</p>
                    <p><span className="font-medium">Property condition:</span> {bookingSnapshot?.propertyCondition || 'Not provided'}</p>
                    <p><span className="font-medium">Supplies choice:</span> {bookingSnapshot?.supplies || 'Not provided'}</p>
                    {cleanerRequiresPickup && Boolean((cleaner as any).transport_pickup_location) && (
                      <p className="sm:col-span-2"><span className="font-medium">Pick-up location:</span> {pickupFullLabel((cleaner as any).transport_pickup_location)}</p>
                    )}
                    <p className="sm:col-span-2"><span className="font-medium">What needs to be cleaned:</span> {bookingSnapshot?.needsCleaning || 'Not provided'}</p>
                    <p className="sm:col-span-2"><span className="font-medium">Total price:</span> {formatCurrency(booking.total_amount)}</p>
                    {bookingSnapshot?.photos && bookingSnapshot.photos.length > 0 && (
                      <div className="sm:col-span-2 space-y-2">
                        <p><span className="font-medium">Photos:</span></p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {bookingSnapshot.photos.map((photoUrl, idx) => (
                            <a key={`${photoUrl}-${idx}`} href={photoUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 bg-white">
                              <img src={photoUrl} alt={`Booking photo ${idx + 1}`} className="h-20 w-full object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {clientSecret ? (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                  {missingAccountItems.length > 0 && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-semibold text-amber-900">Complete your account to send this booking request.</p>
                      <ul className="mt-1 text-xs text-amber-800">
                        {missingAccountItems.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {!phoneVerified && (
                          <Button type="button" variant="outline" onClick={sendPhoneVerificationOtpInline} loading={sendingPhoneOtp} className="h-8 px-3 text-xs">
                            Verify now
                          </Button>
                        )}
                        {!emailVerified && (
                          <Button type="button" variant="outline" onClick={() => router.push('/client/profile')} className="h-8 px-3 text-xs">
                            Verify email to continue
                          </Button>
                        )}
                      </div>
                      {!phoneVerified && showPhoneOtpEntry && (
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={phoneOtpCode}
                            onChange={(event) => setPhoneOtpCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                            placeholder="Enter OTP code"
                            inputMode="numeric"
                            className="sm:max-w-[180px]"
                          />
                          <Button type="button" variant="outline" onClick={verifyPhoneOtpInline} loading={verifyingPhoneOtp} className="h-10 px-3 text-xs sm:w-auto">
                            Confirm Code
                          </Button>
                        </div>
                      )}
                  </div>
                  )}
                  <StripePaymentForm
                    booking={booking}
                    onSuccess={handlePaymentSuccess}
                    onCancelRequest={isPaymentRequiredLocked ? () => setCancelRequestConfirmOpen(true) : undefined}
                    cancelRequestLoading={cancelRequestLoading}
                    validateBeforeSubmit={() => {
                      return refreshVerificationStatus().then((verification) => {
                        const checks: string[] = []
                        if (!verification.emailVerified) checks.push('Verify email')
                        if (!verification.phoneVerified) checks.push('Verify phone number')
                        if (!address.trim() || !city.trim() || !postcode.trim()) checks.push('Add service address')
                        return checks
                      })
                    }}
                  />
                </Elements>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p>Card authorisation could not be initialised for this draft.</p>
                    <div className="mt-2">
                      <Button
                        type="button"
                        onClick={async () => {
                          try {
                            await initializePaymentIntentForBooking(booking.id)
                            toast.success('Payment step is ready. You can authorise your card now.')
                          } catch (err: any) {
                            toast.error(err?.message ?? 'Unable to initialise card authorisation. Please try again.')
                          }
                        }}
                      >
                        Retry payment setup
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Step 4: Confirmation ───────────────────────────────── */}
          {step === 4 && booking && (
            <Card className="border-slate-200">
              <CardContent className="px-5 pb-5 pt-6 text-center space-y-5 sm:px-8 sm:pb-8 sm:pt-6">
                <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center border-4 border-emerald-50">
                  <Check className="h-8 w-8 text-emerald-600" strokeWidth={3} />
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {booking.status === 'confirmed' ? 'Booking Confirmed!' : 'Booking Request Sent!'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {booking.status === 'confirmed'
                      ? `Your service has been successfully booked with ${cleanerName}`
                      : `Your card is authorised and your request has been sent to ${cleanerName}`}
                  </p>
                  {booking.status === 'pending' && (
                    <p className="mt-1 text-xs text-slate-500">
                      {bookingExpiryMessage(booking.accept_by)}
                    </p>
                  )}
                </div>

                {/* Booking details */}
                <div className="mx-auto max-w-sm text-left rounded-xl border border-slate-200 p-4 space-y-3">
                  <h3 className="font-semibold text-slate-900">Booking Details</h3>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Service:</span>
                    <span className="font-medium text-slate-900">{SERVICE_LABELS[booking.service_type] ?? booking.service_type}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Status:</span>
                    <span className="font-medium text-slate-900 capitalize">
                      {booking.status === 'pending'
                        ? booking.proposal_by === 'cleaner'
                          ? 'Awaiting Client Response'
                          : booking.proposal_by === 'client'
                            ? 'Awaiting Cleaner Response'
                            : 'Pending Cleaner Acceptance'
                        : booking.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Date:</span>
                    <span className="font-medium text-slate-900">
                      {new Date(booking.scheduled_start).toLocaleDateString('en-IE', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: APP_TIMEZONE })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Time:</span>
                    <span className="font-medium text-slate-900">
                      {new Date(booking.scheduled_start).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', timeZone: APP_TIMEZONE })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Duration:</span>
                    <span className="font-medium text-slate-900">{booking.duration_hours} hour{booking.duration_hours !== 1 ? 's' : ''}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total:</span>
                    <span>{formatCurrency(booking.total_amount)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 mx-auto max-w-sm">
                  <Button className="w-full" onClick={() => router.push('/client/dashboard')}>
                    Go to Dashboard
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => router.push('/client/cleaners')}>
                    Book Another Service
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar — show on steps 1-3 */}
        {step < 4 && (
          <div className="order-last lg:order-none">
            <BookingSummary
              cleaner={cleaner}
              duration={sidebarDuration}
              breakdown={sidebarBreakdown}
              jobType={jobType}
              date={sidebarDate}
              selectedSlot={sidebarSelectedSlot}
              city={city}
              postcode={postcode}
            />
          </div>
        )}
          </div>
        </div>
      </div>

      <Dialog
        open={cancelRequestConfirmOpen}
        onClose={() => {
          if (cancelRequestLoading) return
          setCancelRequestConfirmOpen(false)
        }}
      >
        <DialogTitle>Cancel draft booking</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Need to change something? Cancel this draft and start a new booking.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setCancelRequestConfirmOpen(false)}
              disabled={cancelRequestLoading}
            >
              Keep draft
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={cancelDraftAndRestart}
              loading={cancelRequestLoading}
            >
              Cancel draft
            </Button>
          </div>
        </div>
      </Dialog>

      <style jsx>{`
        .client-stage {
          position: relative;
          isolation: isolate;
          background: linear-gradient(125deg, #04162f 8%, #0f3b76 58%, #0e5698);
        }

        .client-stage__media {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(105deg, rgba(2, 11, 27, 0.82) 10%, rgba(2, 11, 27, 0.5) 55%, rgba(8, 22, 44, 0.72) 100%),
            radial-gradient(circle at 82% 18%, rgba(56, 220, 255, 0.24), transparent 34%),
            repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0 2px, rgba(255, 255, 255, 0) 2px 12px);
          background-size: cover;
          background-position: center;
          mix-blend-mode: screen;
          opacity: 0.9;
        }

        .client-stage__grain {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(90deg, rgba(255, 255, 255, 0.11) 0%, rgba(255, 255, 255, 0) 45%),
            radial-gradient(circle at 18% 22%, rgba(56, 220, 255, 0.22), transparent 28%),
            radial-gradient(circle at 82% 12%, rgba(244, 180, 0, 0.2), transparent 22%);
          animation: hero-sweep 11s ease-in-out infinite;
          pointer-events: none;
        }

        .animate-stage-up {
          animation: stage-up 0.72s cubic-bezier(0.18, 0.82, 0.3, 1) both;
        }

        .delay-120 {
          animation-delay: 120ms;
        }

        @keyframes stage-up {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes hero-sweep {
          0%,
          100% {
            transform: translateX(0%);
            opacity: 1;
          }
          50% {
            transform: translateX(1.8%);
            opacity: 0.88;
          }
        }
      `}</style>
    </>
  )
}
