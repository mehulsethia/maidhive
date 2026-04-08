'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, CircleCheck, Plus, Trash2 } from 'lucide-react'
import { cleanersApi, availabilityApi, paymentsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { FormPageSkeleton } from '@/components/page-skeletons'
import { cn } from '@/lib/utils'
import type { CleanerOnboardingProgress, CleanerRead } from '@/types'
import { toast } from 'sonner'

const STEP_LABELS = ['1', '2', '3', '4']
const SKILLS = ['Ironing', 'Windows', 'Deep Cleaning', 'Move In/Out']

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

type WeeklySlot = {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  buffer_minutes: number
}

type BlockedTime = {
  id: string
  start_datetime: string
  end_datetime: string
  reason?: string
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function defaultSlots(): WeeklySlot[] {
  return [1, 2, 3, 4, 5].map((day) => ({
    id: uid(),
    day_of_week: day,
    start_time: '09:00',
    end_time: '17:00',
    buffer_minutes: 30,
  }))
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
  const [bio, setBio] = useState('')
  const [hourlyRate, setHourlyRate] = useState('15')
  const [skills, setSkills] = useState<string[]>([])

  const [transportMode, setTransportMode] = useState('')
  const [pickupLocation, setPickupLocation] = useState('')
  const [idType, setIdType] = useState('')
  const [idFileName, setIdFileName] = useState('')
  const [petAcceptance, setPetAcceptance] = useState(false)
  const [workEligibilityConfirmed, setWorkEligibilityConfirmed] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)

  const [slots, setSlots] = useState<WeeklySlot[]>(defaultSlots)
  const [blocked, setBlocked] = useState<BlockedTime[]>([])
  const [blockStart, setBlockStart] = useState('')
  const [blockEnd, setBlockEnd] = useState('')
  const [blockReason, setBlockReason] = useState('')

  const [stripeConnected, setStripeConnected] = useState(false)

  async function loadAll() {
    setLoading(true)
    try {
      const [meRes, scheduleRes, blockedRes, stripeRes] = await Promise.all([
        cleanersApi.me(),
        availabilityApi.getMySchedule(),
        availabilityApi.getMyBlocked(),
        paymentsApi.getConnectStatus(),
      ])

      const cleanerData = meRes.data?.cleaner
      const onboarding = meRes.data?.onboarding
      if (!cleanerData || !onboarding) throw new Error('Failed to load onboarding data.')
      const c = cleanerData as any

      setCleaner(cleanerData)
      setProgress(onboarding)
      setStep(onboarding.current_step)

      setProfileImage(c.profile_image_url ?? c.profileImageUrl ?? '')
      setBio(c.bio ?? '')
      setHourlyRate(String(c.hourly_rate ?? c.hourlyRate ?? 15))
      setSkills(c.skills ?? [])

      setTransportMode(c.transport_mode ?? c.transportMode ?? '')
      setPickupLocation(c.transport_pickup_location ?? c.transportPickupLocation ?? '')
      setIdType(c.id_type ?? c.idType ?? '')
      setIdFileName(c.id_file_name ?? c.idFileName ?? '')
      setPetAcceptance(Boolean(c.pet_acceptance ?? c.petAcceptance))
      setWorkEligibilityConfirmed(Boolean(c.work_eligibility_confirmed ?? c.workEligibilityConfirmed))
      setTermsAccepted(Boolean(c.terms_accepted ?? c.termsAccepted))

      const schedule = (scheduleRes.data ?? []) as any[]
      if (schedule.length > 0) {
        setSlots(
          schedule.map((s) => ({
            id: uid(),
            day_of_week: s.day_of_week ?? s.dayOfWeek,
            start_time: s.start_time ?? s.startTime,
            end_time: s.end_time ?? s.endTime,
            buffer_minutes: s.buffer_minutes ?? s.bufferMinutes ?? 30,
          })),
        )
      }

      setBlocked(
        ((blockedRes.data ?? []) as any[]).map((b) => ({
          id: b.id,
          start_datetime: b.start_datetime ?? b.startDatetime,
          end_datetime: b.end_datetime ?? b.endDatetime,
          reason: b.reason ?? undefined,
        })),
      )
      setStripeConnected(Boolean(stripeRes.data?.connected || stripeRes.data?.charges_enabled))
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
        const connected = Boolean(stripeRes.data?.connected || stripeRes.data?.charges_enabled)
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

  const slotsByDay = useMemo(() => {
    return DAYS.map((day) => ({
      ...day,
      slots: slots.filter((s) => s.day_of_week === day.value),
    }))
  }, [slots])

  function toggleSkill(skill: string) {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]))
  }

  async function saveStep1() {
    if (!profileImage.trim()) return toast.error('Profile picture is required.')
    if (!bio.trim()) return toast.error('Professional bio is required.')
    if (Number(hourlyRate) < 15) return toast.error('Min hourly rate is 15.')
    if (skills.length === 0) return toast.error('Select at least one skill.')

    setSaving(true)
    try {
      const res = await cleanersApi.updateMyOnboarding({
        profile_image_url: profileImage,
        bio,
        hourly_rate: Number(hourlyRate),
        skills,
        onboarding_step: 2,
      })
      setCleaner(res.data?.cleaner ?? cleaner)
      setProgress(res.data?.onboarding ?? progress)
      setStep(2)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save step 1.')
    } finally {
      setSaving(false)
    }
  }

  async function saveStep2() {
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

  async function saveStep3() {
    if (slots.length === 0) return toast.error('Add at least one availability slot.')

    setSaving(true)
    try {
      await availabilityApi.setMySchedule(
        slots.map((s) => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          buffer_minutes: s.buffer_minutes,
          is_active: true,
        })),
      )

      const res = await cleanersApi.updateMyOnboarding({
        onboarding_step: 4,
        onboarding_skipped_step3: false,
      })

      setCleaner(res.data?.cleaner ?? cleaner)
      setProgress(res.data?.onboarding ?? progress)
      setStep(4)
      toast.success('Availability saved.')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save step 3.')
    } finally {
      setSaving(false)
    }
  }

  async function skipStep3() {
    setSaving(true)
    try {
      const res = await cleanersApi.updateMyOnboarding({
        onboarding_step: 4,
        onboarding_skipped_step3: true,
      })
      setCleaner(res.data?.cleaner ?? cleaner)
      setProgress(res.data?.onboarding ?? progress)
      setStep(4)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to skip step 3.')
    } finally {
      setSaving(false)
    }
  }

  async function finishStep4(skip: boolean) {
    setSaving(true)
    try {
      await cleanersApi.updateMyOnboarding({
        onboarding_step: 4,
        onboarding_skipped_step4: skip,
      })
      router.push('/cleaner/dashboard')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to complete onboarding.')
    } finally {
      setSaving(false)
    }
  }

  async function connectStripe() {
    try {
      const res = await paymentsApi.createConnectOnboardLink()
      const url = res.data?.url
      if (!url) throw new Error('Could not create Stripe onboarding link.')
      window.location.href = url
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to connect Stripe.')
    }
  }

  async function addBlockedRange() {
    if (!blockStart || !blockEnd) return toast.error('Add start and end for blocked time.')
    if (new Date(blockEnd) <= new Date(blockStart)) return toast.error('End must be after start.')

    try {
      const res = await availabilityApi.addBlocked({
        start_datetime: new Date(blockStart).toISOString(),
        end_datetime: new Date(blockEnd).toISOString(),
        reason: blockReason || undefined,
      })
      setBlocked((prev) => [...prev, res.data as BlockedTime])
      setBlockStart('')
      setBlockEnd('')
      setBlockReason('')
      toast.success('Blocked date added.')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add blocked date.')
    }
  }

  async function removeBlocked(id: string) {
    try {
      await availabilityApi.deleteBlocked(id)
      setBlocked((prev) => prev.filter((b) => b.id !== id))
    } catch {
      toast.error('Failed to remove blocked date.')
    }
  }

  function addSlot(day: number) {
    setSlots((prev) => [
      ...prev,
      { id: uid(), day_of_week: day, start_time: '09:00', end_time: '12:00', buffer_minutes: 30 },
    ])
  }

  function updateSlot(slotId: string, field: keyof WeeklySlot, value: string | number) {
    setSlots((prev) => prev.map((slot) => (slot.id === slotId ? { ...slot, [field]: value } : slot)))
  }

  function removeSlot(slotId: string) {
    setSlots((prev) => prev.filter((slot) => slot.id !== slotId))
  }

  if (loading) return <FormPageSkeleton />

  return (
    <div className="max-w-xl mx-auto">
      <Card className="bg-[#F7F7F8] border-[#ECECEF]">
        <CardContent className="p-6 md:p-8">
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
                <div className="mt-2 flex items-center gap-3">
                  <label className="h-20 w-20 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center text-[11px] text-gray-500 text-center px-2 cursor-pointer overflow-hidden">
                    {profileImage ? 'Selected' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setProfileImage(e.target.files?.[0]?.name ?? '')}
                    />
                  </label>
                  <Input value={profileImage} onChange={(e) => setProfileImage(e.target.value)} placeholder="Image file name" />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Professional Bio <span className="text-red-500">*</span></Label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Enter your professional bio"
                  rows={4}
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Hourly Rate <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={15}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="Enter your hourly rate"
                  className="mt-2"
                />
                <p className="text-xs text-red-500 text-right mt-1">Min 15</p>
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
                    onChange={(e) => setIdFileName(e.target.value)}
                    placeholder="Click to upload a file"
                  />
                  <input
                    type="file"
                    className="text-xs"
                    onChange={(e) => setIdFileName(e.target.files?.[0]?.name ?? '')}
                  />
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
                  Accept Terms & Platform Rules <span className="text-red-500">*</span>
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
              <div className="space-y-3">
                {slotsByDay.map((day) => (
                  <div key={day.value} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn('inline-flex h-8 min-w-12 px-3 items-center justify-center rounded-xl text-sm font-semibold', day.slots.length > 0 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700')}>
                        {day.label}
                      </span>
                      <button className="text-xs text-primary" onClick={() => addSlot(day.value)} type="button">
                        + Add slot
                      </button>
                    </div>

                    {day.slots.length === 0 ? (
                      <div className="rounded-xl border border-dashed py-2 text-center text-sm text-gray-500">Unavailable</div>
                    ) : (
                      <div className="space-y-2">
                        {day.slots.map((slot) => (
                          <div key={slot.id} className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={slot.start_time}
                              onChange={(e) => updateSlot(slot.id, 'start_time', e.target.value)}
                              className="h-9"
                            />
                            <span className="text-sm text-gray-500">-</span>
                            <Input
                              type="time"
                              value={slot.end_time}
                              onChange={(e) => updateSlot(slot.id, 'end_time', e.target.value)}
                              className="h-9"
                            />
                            <button
                              type="button"
                              onClick={() => removeSlot(slot.id)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border text-gray-600 transition-all duration-200 hover:-translate-y-0.5 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                <p className="text-sm font-medium">Block future date/time</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input type="datetime-local" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} />
                  <Input type="datetime-local" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} />
                </div>
                <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Reason (optional)" />
                <Button variant="outline" onClick={addBlockedRange}>
                  <Plus className="h-4 w-4 mr-1" /> Add blocked date
                </Button>

                {blocked.length > 0 && (
                  <div className="pt-2 space-y-2">
                    {blocked.slice(0, 5).map((b) => (
                      <div key={b.id} className="flex items-center justify-between rounded-xl border p-2 text-xs">
                        <span>{new Date(b.start_datetime).toLocaleString()} - {new Date(b.end_datetime).toLocaleString()}</span>
                        <button type="button" className="text-red-500" onClick={() => removeBlocked(b.id)}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={skipStep3} disabled={saving}>Skip for now</Button>
                  <Button onClick={saveStep3} loading={saving}>Save & Continue</Button>
                </div>
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
                <Button onClick={connectStripe} variant="outline">Connect with Stripe</Button>
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
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => finishStep4(true)} disabled={saving}>Skip for now</Button>
                  <Button onClick={() => finishStep4(false)} loading={saving}>Launch your page</Button>
                </div>
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
