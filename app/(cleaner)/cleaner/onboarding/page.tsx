'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, CircleCheck } from 'lucide-react'
import { cleanersApi, availabilityApi, paymentsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { FormPageSkeleton } from '@/components/page-skeletons'
import { ScheduleEditor } from '@/components/schedule-editor'
import { getAccessToken } from '@/lib/auth-cache'
import { toApiV1Url } from '@/lib/api-base'
import { cn } from '@/lib/utils'
import type { CleanerOnboardingProgress, CleanerRead } from '@/types'
import { toast } from 'sonner'

const STEP_LABELS = ['1', '2', '3', '4']
const SKILLS = ['Ironing', 'Windows', 'Deep Cleaning', 'Move In/Out']
const BIO_MAX_CHARS = 1000
const MIN_HOURLY_RATE = 6
const MAX_HOURLY_RATE = 20

type ValidationIssue = {
  code?: string
  message?: string
  path?: string[] | string
}

function parseValidationIssues(raw: string | undefined): ValidationIssue[] {
  if (!raw) return []
  const candidates = [raw]
  const start = raw.indexOf('[{')
  const end = raw.lastIndexOf('}]')
  if (start >= 0 && end > start) {
    candidates.push(raw.slice(start, end + 2))
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (Array.isArray(parsed)) return parsed as ValidationIssue[]
      if (parsed && Array.isArray((parsed as any).detail)) return (parsed as any).detail as ValidationIssue[]
      if (parsed && typeof parsed === 'object' && 'path' in parsed) return [parsed as ValidationIssue]
    } catch {
      // noop
    }
  }
  return []
}

function getStep1FriendlyError(raw: string | undefined): string | null {
  const issues = parseValidationIssues(raw)
  for (const issue of issues) {
    const field = Array.isArray(issue.path) ? String(issue.path[0] ?? '') : String(issue.path ?? '')
    if (field === 'hourly_rate') return `Hourly rate must be between €${MIN_HOURLY_RATE} and €${MAX_HOURLY_RATE}.`
    if (field === 'bio' && issue.code === 'too_big') return `Professional bio can be up to ${BIO_MAX_CHARS} characters.`
  }
  return null
}


function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-5">
      {STEP_LABELS.map((label, idx) => {
        const stepNum = idx + 1
        const done = current > stepNum
        const active = current === stepNum
        return (
          <div key={label} className="flex items-center">
            <div
              className={cn(
                'h-9 w-9 rounded-full text-sm font-semibold flex items-center justify-center border transition-colors',
                done ? 'bg-primary text-white border-primary' : active ? 'bg-primary text-white border-primary' : 'bg-gray-100 text-gray-600 border-gray-200',
              )}
            >
              {done ? <Check className="h-4 w-4" /> : label}
            </div>
            {idx < STEP_LABELS.length - 1 && <div className="w-8 h-px bg-gray-200" />}
          </div>
        )
      })}
      <div className="h-9 w-9 rounded-full bg-gray-100 text-gray-800 border border-gray-200 flex items-center justify-center ml-2">
        <CircleCheck className="h-4 w-4" />
      </div>
    </div>
  )
}

function CleanerOnboardingPageContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)
  const [progress, setProgress] = useState<CleanerOnboardingProgress | null>(null)

  const [cleaner, setCleaner] = useState<CleanerRead | null>(null)

  const [profileImage, setProfileImage] = useState('')
  const [profileImagePreview, setProfileImagePreview] = useState('')
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false)
  const [bio, setBio] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [skills, setSkills] = useState<string[]>([])

  const [transportMode, setTransportMode] = useState('')
  const [pickupLocation, setPickupLocation] = useState('')
  const [idType, setIdType] = useState('')
  const [idFileName, setIdFileName] = useState('')
  const [idFileUrl, setIdFileUrl] = useState('')
  const [uploadingKyc, setUploadingKyc] = useState(false)
  const [petAcceptance, setPetAcceptance] = useState(false)
  const [workEligibilityConfirmed, setWorkEligibilityConfirmed] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)


  const [stripeConnected, setStripeConnected] = useState(false)
  const scheduleSaveRef = useRef<(() => Promise<void>) | null>(null)

  async function loadAll() {
    setLoading(true)
    try {
      const [meRes, stripeRes] = await Promise.all([
        cleanersApi.me(),
        paymentsApi.getConnectStatus(),
      ])

      const cleanerData = meRes.data?.cleaner
      const onboarding = meRes.data?.onboarding
      if (!cleanerData || !onboarding) throw new Error('Failed to load onboarding data.')
      const c = cleanerData as any

      setCleaner(cleanerData)
      setProgress(onboarding)
      setStep(onboarding.current_step)

      const imgUrl = c.profile_image_url ?? c.profileImageUrl ?? ''
      setProfileImage(imgUrl)
      if (imgUrl) setProfileImagePreview(imgUrl)
      setBio(c.bio ?? '')
      setHourlyRate(c.hourly_rate ?? c.hourlyRate ? String(c.hourly_rate ?? c.hourlyRate) : '')
      setSkills(c.skills ?? [])

      setTransportMode(c.transport_mode ?? c.transportMode ?? '')
      setPickupLocation(c.transport_pickup_location ?? c.transportPickupLocation ?? '')
      setIdType(c.id_type ?? c.idType ?? '')
      setIdFileName(c.id_file_name ?? c.idFileName ?? '')
      setIdFileUrl(c.id_file_url ?? c.idFileUrl ?? '')
      setPetAcceptance(Boolean(c.pet_acceptance ?? c.petAcceptance))
      setWorkEligibilityConfirmed(Boolean(c.work_eligibility_confirmed ?? c.workEligibilityConfirmed))
      setTermsAccepted(Boolean(c.terms_accepted ?? c.termsAccepted))

      setStripeConnected(Boolean(stripeRes.data?.connected))
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to load onboarding.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (!params.get('connected')) return
    ;(async () => {
      try {
        const stripeRes = await paymentsApi.getConnectStatus()
        const connected = Boolean(stripeRes.data?.connected)
        setStripeConnected(connected)
        if (connected) {
          toast.success('Stripe account connected.')
          await loadAll()
        }
      } catch {
        // noop
      }
    })()
  }, [params])

  function toggleSkill(skill: string) {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]))
  }

  async function handleProfileImageUpload(file: File) {
    const localPreview = URL.createObjectURL(file)
    setProfileImagePreview(localPreview)
    setUploadingProfileImage(true)
    try {
      const token = await getAccessToken()
      const form = new FormData()
      form.append('file', file)

      const res = await fetch(toApiV1Url('/upload/profile-image'), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })

      const json = await res.json()
      if (!res.ok || !json.success || !json.data?.url) {
        throw new Error(json.message ?? 'Upload failed')
      }

      setProfileImage(json.data.url)
      setProfileImagePreview(json.data.url)
      toast.success('Profile image uploaded.')
    } catch (err: any) {
      setProfileImage('')
      setProfileImagePreview('')
      toast.error(err.message ?? 'Failed to upload profile image.')
    } finally {
      setUploadingProfileImage(false)
    }
  }

  async function saveStep1() {
    if (saving) return
    if (uploadingProfileImage) return toast.error('Please wait for image upload to finish.')
    if (!profileImage) return toast.error('Profile picture is required.')
    if (!bio.trim()) return toast.error('Professional bio is required.')
    if (bio.trim().length > BIO_MAX_CHARS) return toast.error(`Professional bio can be up to ${BIO_MAX_CHARS} characters.`)
    if (!hourlyRate || Number(hourlyRate) < MIN_HOURLY_RATE) return toast.error(`Min hourly rate is €${MIN_HOURLY_RATE}.`)
    if (Number(hourlyRate) > MAX_HOURLY_RATE) return toast.error(`Max hourly rate is €${MAX_HOURLY_RATE}.`)
    if (skills.length === 0) return toast.error('Select at least one skill.')

    setSaving(true)
    try {
      const res = await cleanersApi.updateMyOnboarding({
        ...(profileImage ? { profile_image_url: profileImage } : {}),
        bio,
        hourly_rate: Number(hourlyRate),
        skills,
        onboarding_step: 2,
      })
      setCleaner(res.data?.cleaner ?? cleaner)
      setProgress(res.data?.onboarding ?? progress)
      setStep(2)
    } catch (err: any) {
      const friendly = getStep1FriendlyError(err?.message)
      toast.error(friendly ?? err?.message ?? 'Failed to save step 1.')
    } finally {
      setSaving(false)
    }
  }

  async function saveStep2() {
    if (saving) return
    if (uploadingKyc) return toast.error('Please wait for KYC document upload to finish.')
    if (!transportMode) return toast.error('Select mode of transport.')
    if (transportMode === 'requires_pickup' && !pickupLocation.trim()) {
      return toast.error('Pick-up/drop-off location is required.')
    }
    if (!idType) return toast.error('Select ID type.')
    if (!idFileName.trim()) return toast.error('Valid ID file is required.')
    if (!workEligibilityConfirmed) return toast.error('Please confirm legal work eligibility.')
    if (!termsAccepted) return toast.error('Please accept terms and platform rules.')

    setSaving(true)
    try {
      const res = await cleanersApi.updateMyOnboarding({
        transport_mode: transportMode,
        transport_pickup_location: transportMode === 'requires_pickup' ? pickupLocation : null,
        id_type: idType,
        id_file_name: idFileName,
        id_file_url: idFileUrl || null,
        pet_acceptance: petAcceptance,
        work_eligibility_confirmed: workEligibilityConfirmed,
        terms_accepted: termsAccepted,
        onboarding_step: 3,
      })
      setCleaner(res.data?.cleaner ?? cleaner)
      setProgress(res.data?.onboarding ?? progress)
      setStep(3)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save step 2.')
    } finally {
      setSaving(false)
    }
  }

  async function finishStep4() {
    if (saving) return
    if (!stripeConnected) {
      toast.error('Stripe connection is required to continue.')
      return
    }

    setSaving(true)
    try {
      await cleanersApi.updateMyOnboarding({
        onboarding_step: 4,
        onboarding_skipped_step4: false,
      })
      router.push('/cleaner/dashboard')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to complete onboarding.')
    } finally {
      setSaving(false)
    }
  }

  async function connectStripe() {
    if (saving) return
    try {
      const res = stripeConnected
        ? await paymentsApi.createConnectDashboardLink()
        : await paymentsApi.createConnectOnboardLink()
      const url = res.data?.url
      if (!url) throw new Error('Could not open Stripe.')
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) throw new Error('Please allow popups to open Stripe.')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to open Stripe.')
    }
  }

  async function handleKycUpload(file: File) {
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

  if (loading) return <FormPageSkeleton />

  async function saveScheduleAndContinue() {
    if (saving) return
    if (!scheduleSaveRef.current) return
    setSaving(true)
    try {
      await scheduleSaveRef.current()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <Card className="bg-[#F7F7F8] border-[#ECECEF]">
        <CardContent className="px-6 pb-6 pt-6 md:px-8 md:pb-8 md:pt-6">
          <StepDots current={step} />

          <p className="text-center text-[32px] leading-none text-primary font-semibold mb-1">
            {progress?.completion_pct ?? 0}%
          </p>
          <p className="text-center text-sm text-gray-700 mb-4">Welcome on board. Please complete your account setup to get started.</p>
          <div className="h-px bg-gray-200 mb-5" />

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Profile Picture <span className="text-red-500">*</span></Label>
                <div className="mt-2 flex items-center gap-4">
                  <label className="relative h-20 w-20 shrink-0 rounded-full bg-gray-200 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden hover:border-primary/50 transition-colors">
                    {profileImagePreview ? (
                      <img src={profileImagePreview} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[11px] text-gray-500 text-center leading-tight">Upload<br/>Photo</span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        await handleProfileImageUpload(file)
                      }}
                    />
                  </label>
                  <p className="text-xs text-gray-500">
                    {uploadingProfileImage ? 'Uploading image...' : (profileImage ? 'Profile image ready' : 'Click the circle to upload a photo')}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Professional Bio <span className="text-red-500">*</span></Label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Enter your professional bio"
                  rows={4}
                  maxLength={BIO_MAX_CHARS}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum {BIO_MAX_CHARS} characters.</p>
              </div>

              <div>
                <Label className="text-sm font-medium">Hourly Rate <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={MIN_HOURLY_RATE}
                  max={MAX_HOURLY_RATE}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder={`Enter your hourly rate (€${MIN_HOURLY_RATE} – €${MAX_HOURLY_RATE})`}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 text-right mt-1">€{MIN_HOURLY_RATE} – €{MAX_HOURLY_RATE} per hour</p>
              </div>

              <div>
                <Label className="text-sm font-medium">Skills <span className="text-red-500">*</span></Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SKILLS.map((skill) => {
                    const active = skills.includes(skill)
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={cn(
                          'rounded-xl border px-3 py-1.5 text-sm transition-all duration-200 hover:-translate-y-0.5',
                          active ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                        )}
                      >
                        {skill}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button onClick={saveStep1} loading={saving} className="min-w-36">Save & Continue</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Mode of Transport <span className="text-red-500">*</span></Label>
                <Select value={transportMode} onChange={(e) => setTransportMode(e.target.value)} className="mt-2">
                  <option value="">Choose an option...</option>
                  <option value="own_car">Own Car</option>
                  <option value="bus_walk">Bus / Walk</option>
                  <option value="requires_pickup">Requires Pick-up</option>
                </Select>
              </div>

              {transportMode === 'requires_pickup' && (
                <div>
                  <Label className="text-sm font-medium">Pick-up/Drop-off Location <span className="text-red-500">*</span></Label>
                  <Input
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    placeholder="Enter pick-up/drop-off location"
                    className="mt-2"
                  />
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">ID Type <span className="text-red-500">*</span></Label>
                <Select value={idType} onChange={(e) => setIdType(e.target.value)} className="mt-2">
                  <option value="">Choose an option...</option>
                  <option value="passport">Passport</option>
                  <option value="national_id">National ID card</option>
                  <option value="drivers_licence">Driver&apos;s licence</option>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Valid ID <span className="text-red-500">*</span></Label>
                <div className="mt-2 space-y-2">
                  <Input
                    value={idFileName}
                    readOnly
                    placeholder="Upload a file below"
                  />
                  <input
                    type="file"
                    className="text-xs"
                    accept=".pdf,image/*"
                    disabled={uploadingKyc}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      await handleKycUpload(file)
                    }}
                  />
                  {idFileUrl && (
                    <a href={idFileUrl} target="_blank" rel="noreferrer" className="block text-xs font-medium text-primary hover:underline">
                      View uploaded KYC document
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={petAcceptance} onChange={(e) => setPetAcceptance(e.target.checked)} />
                  Pet Acceptance
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={workEligibilityConfirmed} onChange={(e) => setWorkEligibilityConfirmed(e.target.checked)} />
                  I confirm I am legally allowed to work <span className="text-red-500">*</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
                  <span>Accept <a href="/terms" target="_blank" className="text-primary font-medium underline hover:text-primary/80">Terms & Platform Rules</a> <span className="text-red-500">*</span></span>
                </label>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={saveStep2} loading={saving}>Save & Continue</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <ScheduleEditor
                compact
                saveRef={scheduleSaveRef}
                onSaveExternal={async (schedules) => {
                  if (schedules.length === 0) {
                    toast.error('Add at least one availability slot.')
                    throw new Error('No slots')
                  }
                  await availabilityApi.setMySchedule(schedules)
                  const res = await cleanersApi.updateMyOnboarding({
                    onboarding_step: 4,
                    onboarding_skipped_step3: false,
                  })
                  setCleaner(res.data?.cleaner ?? cleaner)
                  setProgress(res.data?.onboarding ?? progress)
                  setStep(4)
                  toast.success('Availability saved.')
                }}
              />

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={saveScheduleAndContinue} loading={saving} className="min-w-36">Save & Continue</Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="border rounded-xl p-3 bg-white flex items-start justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold text-[#635BFF] leading-none">stripe</p>
                  <p className="text-sm text-gray-500 mt-2">Manage your earnings and payouts seamlessly.</p>
                  <a href="https://stripe.com/connect" target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary hover:underline">Click here to learn more.</a>
                </div>
                <Button onClick={connectStripe} variant="outline">{stripeConnected ? 'Manage Stripe' : 'Connect with Stripe'}</Button>
              </div>

              {stripeConnected && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-2 text-sm text-green-700">
                  Stripe is connected. You can now receive payouts.
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={finishStep4} loading={saving}>Launch your page</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {progress && progress.completion_pct < 100 && (
        <p className="text-xs text-gray-600 mt-3 text-center">
          Your profile is {progress.completion_pct}% complete. Cleaner profiles are visible to clients only at 100% completion.
        </p>
      )}
    </div>
  )
}

export default function CleanerOnboardingPage() {
  return (
    <Suspense fallback={<FormPageSkeleton />}>
      <CleanerOnboardingPageContent />
    </Suspense>
  )
}
