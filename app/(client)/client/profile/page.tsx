'use client'

import { useDeferredValue, useEffect, useState, startTransition } from 'react'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { CreditCard, ShieldCheck } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { bookingsApi, clientsApi, paymentsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ProfilePageSkeleton } from '@/components/page-skeletons'
import { AvatarUpload } from '@/components/avatar-upload'
import { PhoneInput } from '@/components/phone-input'
import { formatCurrency } from '@/lib/utils'
import { getAccessToken } from '@/lib/auth-cache'
import { toApiV1Url } from '@/lib/api-base'
import { createClient } from '@/lib/supabase'
import type { BookingRead } from '@/types'
import { toast } from 'sonner'

const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function ClientProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bookings, setBookings] = useState<BookingRead[]>([])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [defaultAddress, setDefaultAddress] = useState('')
  const [defaultCity, setDefaultCity] = useState('')
  const [defaultPostcode, setDefaultPostcode] = useState('')
  const [memberSince, setMemberSince] = useState('')
  const [idFileName, setIdFileName] = useState('')
  const [idFileUrl, setIdFileUrl] = useState('')
  const [uploadingId, setUploadingId] = useState(false)
  const [savedCards, setSavedCards] = useState<Array<{ id: string; brand: string; last4: string; exp_month: number | null; exp_year: number | null }>>([])
  const [setupSecret, setSetupSecret] = useState<string | null>(null)
  const [loadingPayment, setLoadingPayment] = useState(false)
  const [removingCardId, setRemovingCardId] = useState<string | null>(null)
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [emailVerified, setEmailVerified] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [verifiedPhoneFromAuth, setVerifiedPhoneFromAuth] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [clientRes, bookingRes, authUserRes] = await Promise.all([clientsApi.me(), bookingsApi.my(), createClient().auth.getUser()])
        const client = clientRes.data as any
        const user = client?.user ?? {}
        const fullName = String(user?.name ?? '').trim()
        const parts = fullName.split(' ').filter(Boolean)

        startTransition(() => {
          setFirstName(parts[0] ?? '')
          setLastName(parts.slice(1).join(' '))
          setEmail(user?.email ?? '')
          setPhone(user?.phone ?? '')
          setDefaultAddress(client?.default_address ?? '')
          setDefaultCity(client?.default_city ?? '')
          setDefaultPostcode(client?.default_postcode ?? '')
          setIdFileName(client?.id_file_name ?? '')
          setIdFileUrl(client?.id_file_url ?? '')
          setMemberSince(
            client?.created_at
              ? new Date(client.created_at).toLocaleDateString('en-IE', { month: 'short', year: 'numeric', timeZone: 'Europe/Nicosia' })
              : '',
          )
          setBio('')
          setAvatarUrl(user?.avatar_url ?? null)
          setEmailVerified(Boolean(authUserRes.data.user?.email_confirmed_at))
          setPhoneVerified(Boolean(authUserRes.data.user?.phone_confirmed_at))
          setVerifiedPhoneFromAuth(Boolean(authUserRes.data.user?.phone_confirmed_at) ? (authUserRes.data.user?.phone ?? '') : '')
          setBookings(bookingRes.data?.items ?? [])
          setLoading(false)
        })
      } catch {
        toast.error('Failed to load profile.')
        setLoading(false)
      }
    })()
  }, [])

  async function loadPaymentMethods() {
    setLoadingPayment(true)
    try {
      const methodsRes = await paymentsApi.listMethods()
      setSavedCards(methodsRes.data ?? [])
    } finally {
      setLoadingPayment(false)
    }
  }

  useEffect(() => {
    loadPaymentMethods().catch(() => null)
  }, [])

  const deferredBookings = useDeferredValue(bookings)
  const totalBookings = deferredBookings.length
  const totalSpent = deferredBookings
    .filter((booking) => booking.status === 'completed')
    .reduce((sum, booking) => sum + Number(booking.total_amount ?? 0), 0)

  async function saveProfile() {
    if (!firstName.trim()) return toast.error('First name is required.')
    if (!lastName.trim()) return toast.error('Last name is required.')
    if (!phone.trim()) return toast.error('Phone number is required.')

    setSaving(true)
    try {
      const supabase = createClient()
      const currentAuth = await supabase.auth.getUser()
      const currentEmail = currentAuth.data.user?.email ?? ''
      const currentPhone = currentAuth.data.user?.phone ?? ''
      const currentPhoneVerified = Boolean(currentAuth.data.user?.phone_confirmed_at)
      const currentVerifiedPhone = currentPhoneVerified ? currentPhone : ''
      if (email.trim() && email.trim() !== currentEmail) {
        await supabase.auth.updateUser({ email: email.trim() })
        toast.success('Verification email sent. Please verify your new email.')
      }
      if (phone.trim() && phone.trim() !== currentPhone) {
        await supabase.auth.updateUser({ phone: phone.trim() })
        toast.success('Verification SMS sent. Please verify your new phone number.')
      }
      const profilePayload: {
        name: string
        phone?: string
        default_address: string | null
        default_city: string | null
        default_postcode: string | null
      } = {
        name: `${firstName.trim()} ${lastName.trim()}`,
        default_address: defaultAddress || null,
        default_city: defaultCity || null,
        default_postcode: defaultPostcode || null,
      }
      if (currentVerifiedPhone) profilePayload.phone = currentVerifiedPhone
      await clientsApi.updateMe(profilePayload)
      toast.success('Profile updated.')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!phoneVerified || !verifiedPhoneFromAuth) return
    if (verifiedPhoneFromAuth === phone) return
    setPhone(verifiedPhoneFromAuth)
    clientsApi.updateMe({ phone: verifiedPhoneFromAuth }).catch(() => null)
  }, [phoneVerified, verifiedPhoneFromAuth])

  async function removeCard(paymentMethodId: string) {
    setRemovingCardId(paymentMethodId)
    try {
      await paymentsApi.deleteMethod(paymentMethodId)
      toast.success('Card removed.')
      await loadPaymentMethods()
    } catch (err: any) {
      const fallbackCard = savedCards.find((card) => card.id !== paymentMethodId)
      if (fallbackCard) {
        try {
          await paymentsApi.deleteMethod(paymentMethodId, fallbackCard.id)
          toast.success('Card removed after re-authorising linked bookings.')
          await loadPaymentMethods()
          return
        } catch (retryErr: any) {
          toast.error(retryErr.message ?? 'Card cannot be removed right now.')
          return
        }
      }
      toast.error(err.message ?? 'Card cannot be removed right now.')
    } finally {
      setRemovingCardId(null)
    }
  }

  async function initializeCardSetup() {
    try {
      const res = await paymentsApi.createSetupIntent()
      const clientSecret = res.data?.client_secret ?? null
      if (!clientSecret) {
        toast.error('Unable to initialize card setup.')
        return
      }
      setSetupSecret(clientSecret)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to initialize card setup.')
    }
  }

  async function uploadClientIdDocument(file: File) {
    if (!file) return
    setUploadingId(true)
    try {
      const token = await getAccessToken()
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(toApiV1Url('/upload/client-id-document'), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? 'Failed to upload ID document.')
      }
      setIdFileName(String(json.data?.file_name ?? file.name))
      setIdFileUrl(String(json.data?.url ?? ''))
      toast.success('ID provided.')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to upload ID document.')
    } finally {
      setUploadingId(false)
    }
  }

  if (loading) return <ProfilePageSkeleton />

  const fullName = `${firstName} ${lastName}`.trim() || 'Client'
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
  const hasAvatar = Boolean(avatarUrl)
  const hasIdSubmitted = Boolean(idFileUrl)

  return (
    <>
      <div className="client-profile-revamp space-y-7 md:space-y-9">
        <section className="client-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
          <div className="client-stage__media" aria-hidden="true" />
          <div className="client-stage__grain" aria-hidden="true" />

          <div className="relative z-10 grid gap-3 px-5 py-3 sm:px-6 sm:py-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-8 lg:py-4">
            <div className="animate-stage-up space-y-4">
              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                MaidHive Identity Vault
              </p>
              <h1 className={`${displayFont.className} text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl`}>
                Client Profile
              </h1>
              <p className="max-w-xl text-sm text-slate-100/90 sm:text-base">
                Manage your personal details, default booking addresses, and account preferences from one polished workspace.
              </p>
            </div>

            <div className="animate-stage-up delay-120">
              <div className="ml-auto w-full max-w-sm rounded-3xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm">
                <p className={`${monoFont.className} text-[0.62rem] uppercase tracking-[0.18em] text-cyan-200/90`}>
                  Account Snapshot
                </p>
                <p className={`${displayFont.className} mt-1 text-2xl font-bold tracking-[-0.02em] text-white`}>
                  {fullName}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <StatTile label="Bookings" value={totalBookings} monoFont={monoFont.className} displayFont={displayFont.className} />
                  <StatTile label="Spent" value={formatCurrency(totalSpent)} monoFont={monoFont.className} displayFont={displayFont.className} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_45px_rgba(11,33,78,0.08)] backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <AvatarUpload
                currentUrl={avatarUrl}
                fallbackInitial={initials || 'C'}
                onUploaded={(url) => setAvatarUrl(url)}
              />
              <div className="min-w-0">
                <p className={`${displayFont.className} text-2xl font-bold tracking-[-0.02em] text-slate-900`}>{fullName}</p>
                <p className="truncate text-sm text-slate-500">{email || 'No email available'}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {memberSince && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      Member since {memberSince}
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {deferredBookings.filter((booking) => booking.status === 'completed').length} completed bookings
                  </span>
                  {idFileUrl && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      ID provided
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Button variant="outline" onClick={saveProfile} loading={saving} className="mt-4 w-full rounded-full">
              Update Credentials
            </Button>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_45px_rgba(11,33,78,0.08)] backdrop-blur-sm">
            <h2 className={`${displayFont.className} text-2xl font-bold tracking-[-0.02em] text-slate-900`}>
              Profile Details
            </h2>
            <p className="mt-1 text-sm text-slate-500">These details are used to prefill future bookings.</p>

            {(!hasAvatar || !hasIdSubmitted) && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-900">Complete trust signals</p>
                <p className="mt-1 text-xs text-amber-800">
                  Add a profile photo and optional ID to improve cleaner acceptance rates.
                </p>
              </div>
            )}

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Field label="First Name"><Input value={firstName} onChange={(event) => setFirstName(event.target.value)} className="mt-1" /></Field>
              <Field label="Last Name"><Input value={lastName} onChange={(event) => setLastName(event.target.value)} className="mt-1" /></Field>
              <Field label="Phone Number"><PhoneInput value={phone} onChange={setPhone} className="mt-1" /></Field>
              <Field label="Default Address"><Input value={defaultAddress} onChange={(event) => setDefaultAddress(event.target.value)} className="mt-1" /></Field>
              <Field label="Default City"><Input value={defaultCity} onChange={(event) => setDefaultCity(event.target.value)} className="mt-1" /></Field>
              <Field label="Default Postcode"><Input value={defaultPostcode} onChange={(event) => setDefaultPostcode(event.target.value)} className="mt-1" /></Field>
            </div>

            <div className="mt-4">
              <Label>Notes For Future Bookings (optional)</Label>
              <Textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                className="mt-1"
                rows={4}
                placeholder="Saved locally in this browser for now."
              />
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Account Credentials</p>
              <p className="mt-1 text-xs text-slate-600">Verified contact details are required for booking communication.</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                <li>- Email: {email || 'Not set'} ({emailVerified ? 'Verified' : 'Not verified'})</li>
                <li>- Phone: {phone || 'Not set'} ({phoneVerified ? 'Verified' : 'Not verified'})</li>
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Trust Signals</p>
              <p className="mt-1 text-xs text-slate-600">Complete this to improve cleaner acceptance rates.</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                <li>- Profile photo: {hasAvatar ? 'Added' : 'Pending'}</li>
                <li>- Optional ID: {hasIdSubmitted ? 'Submitted' : 'Pending'}</li>
              </ul>
              <div className="mt-3">
                <Label>Optional ID Upload (PDF or image)</Label>
                <Input
                  type="file"
                  accept=".pdf,image/*"
                  className="mt-1"
                  disabled={uploadingId}
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    await uploadClientIdDocument(file)
                  }}
                />
                {idFileName && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    ID provided: {idFileName}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Payment Method</p>
                  <p className="mt-1 text-xs text-slate-600">Add a card before booking, or add one during checkout.</p>
                </div>
                <CreditCard className="h-5 w-5 text-slate-500" />
              </div>

              {loadingPayment ? (
                <p className="mt-3 text-xs text-slate-500">Loading saved cards...</p>
              ) : savedCards.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No saved cards yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {savedCards.map((card) => (
                    <div key={card.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          {card.brand.toUpperCase()} •••• {card.last4}
                          {card.exp_month && card.exp_year ? ` (exp ${card.exp_month}/${card.exp_year})` : ''}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeCard(card.id)}
                          loading={removingCardId === card.id}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!setupSecret ? (
                <Button onClick={initializeCardSetup} variant="outline" className="mt-3">
                  Add Card
                </Button>
              ) : (
                <div className="mt-3">
                  <Elements stripe={stripePromise} options={{ clientSecret: setupSecret }}>
                    <AddCardForm
                      onAdded={async () => {
                        setSetupSecret(null)
                        await loadPaymentMethods()
                      }}
                    />
                  </Elements>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <Button onClick={saveProfile} loading={saving} className="rounded-full bg-[#0d4bc9] hover:bg-[#0a3ea8]">
                Save & Publish
              </Button>
            </div>
          </div>
        </section>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function AddCardForm({ onAdded }: { onAdded: () => Promise<void> }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  async function handleAddCard() {
    if (!stripe || !elements) return
    setSubmitting(true)
    try {
      const { error } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      })
      if (error) {
        toast.error(error.message ?? 'Failed to add card.')
      } else {
        await onAdded()
        toast.success('Card added successfully.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      <PaymentElement />
      <Button onClick={handleAddCard} loading={submitting} disabled={!stripe || !elements}>
        Save Card
      </Button>
    </div>
  )
}

function StatTile({
  label,
  value,
  monoFont,
  displayFont,
}: {
  label: string
  value: string | number
  monoFont: string
  displayFont: string
}) {
  return (
    <div className="rounded-2xl border border-white/25 bg-white/10 p-3 text-white">
      <p className={`${monoFont} text-[0.6rem] uppercase tracking-[0.18em] text-white/70`}>{label}</p>
      <p className={`${displayFont} mt-1 text-lg font-bold tracking-[-0.02em]`}>{value}</p>
    </div>
  )
}
