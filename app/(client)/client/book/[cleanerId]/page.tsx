'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, Lock, Shield, Star } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { cleanersApi, bookingsApi, availabilityApi, clientsApi, paymentsApi } from '@/lib/api'
import { FormPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookableCalendar } from '@/components/ui/bookable-calendar'
import { formatCurrency, cn, APP_TIMEZONE } from '@/lib/utils'
import type { CleanerRead, PriceBreakdown, BookingRead, ClientProfileRead } from '@/types'
import { PhoneInput } from '@/components/phone-input'
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

const STEP_INFO = [
  { num: 1, title: 'Schedule', desc: 'Choose duration and date' },
  { num: 2, title: 'Your\nDetails', desc: 'Contact and location info' },
  { num: 3, title: 'Payment', desc: 'Secure payment processing' },
  { num: 4, title: 'Confirmation', desc: 'Booking confirmation' },
]

// ── Step indicator ────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEP_INFO.map((s, idx) => {
        const done = current > s.num
        const active = current === s.num
        return (
          <div key={s.num} className="flex items-center">
            <div className="flex flex-col items-center w-20 sm:w-28">
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${done ? 'bg-primary text-white' : active ? 'bg-primary text-white ring-4 ring-primary/20' : 'bg-slate-100 text-slate-400'
                  }`}
              >
                {done ? <Check className="h-4 w-4" /> : s.num}
              </div>
              <p className={`mt-1.5 text-center text-[10px] leading-tight whitespace-pre-line ${active || done ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
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
}: {
  cleaner: CleanerRead
  duration: number
  breakdown: PriceBreakdown | null
}) {
  const cleanerName = cleaner.user?.name ?? 'Professional Cleaner'
  return (
    <Card className="rounded-2xl border-slate-200 sticky top-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold">Booking Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Cleaner info */}
        <div className="flex items-center gap-3">
          {cleaner.profile_image_url ? (
            <img src={cleaner.profile_image_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold">{cleanerName.charAt(0)}</span>
            </div>
          )}
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
            <span className="text-slate-700">Cleaning Service</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            <span>{duration} hour{duration !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <Separator />

        {/* Price breakdown */}
        {breakdown && (
          <div className="space-y-2 text-sm pt-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Service ({duration}h)</span>
              <span className="font-semibold text-slate-900">{formatCurrency(breakdown.subtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Service fee</span>
              <span className="font-semibold text-slate-900">{formatCurrency(breakdown.platform_fee)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between items-center font-bold">
              <span className="text-slate-900">Total</span>
              <span className="text-lg text-primary">{formatCurrency(breakdown.total_amount)}</span>
            </div>
          </div>
        )}

        {/* Trust signals */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Shield className="h-3.5 w-3.5 text-slate-400" /> Secure payment processing
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" /> Satisfaction guaranteed
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5 text-slate-400" /> Free cancellation up to 24h
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Stripe Payment Form (inner) ──────────────────────────────────────────
function StripePaymentForm({ onSuccess, totalAmount }: { onSuccess: () => Promise<void>; totalAmount: number }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
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
      toast.error('Card was authorized, but booking sync failed. Please retry in Bookings.')
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

      <PaymentElement />

      <p className="text-xs text-slate-500">
        I agree to the Terms of Service and Privacy Policy. I understand that payment will be processed securely.
        Your card is authorised now. Stripe only captures payment after your job is completed.
      </p>

      <div className="flex items-center justify-between pt-2">
        <span className="text-sm text-slate-500">Total: <strong className="text-slate-900">{formatCurrency(totalAmount)}</strong></span>
        <Button onClick={handleSubmit} loading={submitting} disabled={!stripe || !elements}>
          Authorize Card & Send Request
        </Button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function BookingFlowPage() {
  const { cleanerId } = useParams<{ cleanerId: string }>()
  const router = useRouter()

  const [cleaner, setCleaner] = useState<CleanerRead | null>(null)
  const [clientProfile, setClientProfile] = useState<ClientProfileRead | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)

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
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postcode, setPostcode] = useState('')
  const [notes, setNotes] = useState('')

  // Step 3: Payment
  const [booking, setBooking] = useState<BookingRead | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Load cleaner + client profile
  useEffect(() => {
    Promise.all([
      cleanersApi.getById(cleanerId),
      clientsApi.me().catch(() => null),
    ])
      .then(([cleanerRes, clientRes]) => {
        setCleaner(cleanerRes.data ?? null)
        const cp = (clientRes as any)?.data ?? null
        const cpAny = (cp ?? {}) as any
        const user = cpAny.user ?? {}
        setClientProfile(cp)

        // Autofill from client profile
        if (cp) {
          if (user?.name) {
            const parts = user.name.trim().split(' ')
            setFirstName(parts[0] ?? '')
            setLastName(parts.slice(1).join(' '))
          }
          if (user?.email) setEmail(user.email)
          if (user?.phone) setPhone(user.phone)
          if (cpAny.default_address ?? cpAny.defaultAddress) setAddress(cpAny.default_address ?? cpAny.defaultAddress)
          if (cpAny.default_city ?? cpAny.defaultCity) setCity(cpAny.default_city ?? cpAny.defaultCity)
          if (cpAny.default_postcode ?? cpAny.defaultPostcode) setPostcode(cpAny.default_postcode ?? cpAny.defaultPostcode)
        }
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => { setLoading(false) })
  }, [cleanerId])

  // Fetch available slots when date or duration changes
  useEffect(() => {
    if (!date || !cleanerId) return
    setSlotsLoading(true)
    setSelectedSlot('')
    availabilityApi.getSlots(cleanerId, date, duration)
      .then(r => setSlots(r.data ?? []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [date, duration, cleanerId])

  useEffect(() => {
    if (!cleanerId) return
    setBookableDatesLoading(true)
    setDate('')
    setBookableDates([])
    availabilityApi.getBookableDates(cleanerId, duration, 45)
      .then((r) => setBookableDates(r.data ?? []))
      .catch(() => setBookableDates([]))
      .finally(() => setBookableDatesLoading(false))
  }, [cleanerId, duration])

  // Fetch price breakdown when duration changes
  useEffect(() => {
    if (!cleanerId) return
    bookingsApi.previewPrice(cleanerId, duration)
      .then(r => setBreakdown(r.data ?? null))
      .catch(() => { })
  }, [duration, cleanerId])

  const estimatedCost = useMemo(() => {
    if (!cleaner) return 0
    return cleaner.hourly_rate * duration
  }, [cleaner, duration])

  // Navigation
  function goNext() {
    if (step === 1) {
      if (!date) { toast.error('Please select a date.'); return }
      if (!selectedSlot) { toast.error('Please select a time slot.'); return }
      setStep(2)
    } else if (step === 2) {
      if (!firstName.trim()) { toast.error('First name is required.'); return }
      if (!lastName.trim()) { toast.error('Last name is required.'); return }
      if (!email.trim()) { toast.error('Email is required.'); return }
      if (!phone.trim()) { toast.error('Phone number is required.'); return }
      if (!address.trim()) { toast.error('Service address is required.'); return }
      if (!city.trim()) { toast.error('City is required.'); return }
      if (!postcode.trim()) { toast.error('ZIP code is required.'); return }
      createBookingAndProceed()
    }
  }

  async function createBookingAndProceed() {
    setSubmitting(true)
    try {
      const res = await bookingsApi.create({
        cleaner_id: cleanerId,
        service_type: 'standard',
        address: address.trim(),
        city: city.trim(),
        postcode: postcode.trim(),
        scheduled_start: selectedSlot,
        duration_hours: duration,
        special_instructions: notes || undefined,
      })
      const b = res.data
      if (!b) throw new Error('Failed to create booking')
      setBooking(b)

      const intentRes = await paymentsApi.createIntent(b.id)
      const nextClientSecret = intentRes.data?.client_secret ?? null
      if (!nextClientSecret) {
        throw new Error('Unable to initialize card authorization for this booking')
      }
      setClientSecret(nextClientSecret)
      setStep(3)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create booking')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePaymentSuccess() {
    if (!booking) throw new Error('Missing booking context for authorization sync')

    await paymentsApi.syncAuthorization(booking.id)
    const bookingRes = await bookingsApi.getById(booking.id)
    if (bookingRes.data) {
      setBooking(bookingRes.data)
    }
    setStep(4)
  }

  if (loading) return <FormPageSkeleton />
  if (!cleaner) return <div className="text-center py-16 text-muted-foreground">Cleaner not found.</div>

  const cleanerName = cleaner.user?.name ?? 'Professional Cleaner'

  return (
    <>
      <div className="client-book-flow-revamp space-y-7 md:space-y-9">
        <section className="client-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
          <div className="client-stage__media" aria-hidden="true" />
          <div className="client-stage__grain" aria-hidden="true" />

          <div className="relative z-10 grid gap-3 px-5 py-3 sm:px-6 sm:py-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-8 lg:py-4">
            <div className="animate-stage-up space-y-4">
              <button
                onClick={() => step > 1 && step < 4 ? setStep(step - 1) : router.back()}
                className="inline-flex items-center gap-1 rounded-full border border-white/35 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4" /> {step > 1 && step < 4 ? 'Previous' : 'Back to All Cleaners'}
              </button>
              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                MaidHive Booking Flow
              </p>
              <h1 className={`${displayFont.className} text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl`}>
                Book {cleanerName}
              </h1>
              <p className="max-w-xl text-sm text-slate-100/90 sm:text-base">
                Select schedule, fill details, authorize payment, and confirm your booking in one guided flow.
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
                  {step === 1 ? 'Schedule' : step === 2 ? 'Your Details' : step === 3 ? 'Payment' : 'Confirmation'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl">
          <StepIndicator current={step} />

          <div className={cn('grid gap-6', step < 4 ? 'lg:grid-cols-[1fr_320px]' : 'max-w-2xl mx-auto w-full')}>
        {/* Main content */}
        <div>
          {/* ── Step 1: Service & Date ─────────────────────────────── */}
          {step === 1 && (
            <Card className="rounded-2xl border-slate-200">
              <CardHeader>
                <CardTitle>Select Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div>
                    <Label className="text-sm font-semibold text-slate-700">Duration</Label>
                    <Select value={String(duration)} onChange={e => setDuration(Number(e.target.value))} className="mt-1">
                      {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} hour{d !== 1 ? 's' : ''}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-slate-700">Hourly Rate</Label>
                    <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(cleaner.hourly_rate)}<span className="text-sm font-normal text-slate-500">/hr</span></p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-slate-700">Estimated Cost</Label>
                    <p className="mt-1 text-lg font-bold text-primary">{formatCurrency(estimatedCost)}</p>
                  </div>
                </div>

                {/* Date picker */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Preferred Date</Label>
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

                {/* Time slots */}
                {date && (
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Select time of day</Label>
                    {slotsLoading ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="h-11 rounded-xl bg-slate-100 animate-pulse" />
                        ))}
                      </div>
                    ) : slots.length === 0 ? (
                      <p className="text-sm text-slate-500">No available slots on this date.</p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
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
                  <Button onClick={goNext} className="gap-2">
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step 2: Your Details ───────────────────────────────── */}
          {step === 2 && (
            <Card className="rounded-2xl border-slate-200">
              <CardHeader>
                <CardTitle>Your Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm font-semibold">First Name <span className="text-red-500">*</span></Label>
                    <Input required value={firstName} onChange={e => setFirstName(e.target.value)} className="mt-1" placeholder="John" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Last Name <span className="text-red-500">*</span></Label>
                    <Input required value={lastName} onChange={e => setLastName(e.target.value)} className="mt-1" placeholder="Doe" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Email <span className="text-red-500">*</span></Label>
                    <Input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1" placeholder="john@example.com" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Phone Number <span className="text-red-500">*</span></Label>
                    <PhoneInput value={phone} onChange={setPhone} className="mt-1" />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-semibold">Service Address <span className="text-red-500">*</span></Label>
                  <Input required value={address} onChange={e => setAddress(e.target.value)} className="mt-1" placeholder="Street address" />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm font-semibold">City <span className="text-red-500">*</span></Label>
                    <Input required value={city} onChange={e => setCity(e.target.value)} className="mt-1" placeholder="Dublin" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">ZIP Code <span className="text-red-500">*</span></Label>
                    <Input required value={postcode} onChange={e => setPostcode(e.target.value)} className="mt-1" placeholder="D01 AB12" />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-semibold">Project Description</Label>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Describe your project in detail..."
                    className="mt-1"
                    rows={3}
                  />
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" /> Previous
                  </button>
                  <Button onClick={goNext} loading={submitting} className="gap-1.5">
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step 3: Payment ────────────────────────────────────── */}
          {step === 3 && clientSecret && booking && (
            <Card className="rounded-2xl border-slate-200">
              <CardHeader>
                <CardTitle>Payment Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">

                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                  <StripePaymentForm
                    onSuccess={handlePaymentSuccess}
                    totalAmount={booking.total_amount}
                  />
                </Elements>
              </CardContent>
            </Card>
          )}

          {/* ── Step 4: Confirmation ───────────────────────────────── */}
          {step === 4 && booking && (
            <Card className="border-slate-200">
              <CardContent className="p-5 sm:p-8 text-center space-y-5">
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
                      : `Your card is authorized and your request has been sent to ${cleanerName}`}
                  </p>
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
                    <span className="font-medium text-slate-900 capitalize">{booking.status.replace('_', ' ')}</span>
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
          <div className="hidden lg:block">
            <BookingSummary
              cleaner={cleaner}
              duration={duration}
              breakdown={breakdown}
            />
          </div>
        )}
          </div>
        </div>
      </div>

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
