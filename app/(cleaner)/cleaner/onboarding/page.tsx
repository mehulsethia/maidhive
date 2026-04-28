'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, ChevronRight, CircleCheck } from 'lucide-react'
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

const STEP_LABELS = ['1', '2', '3', '4', '5']
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
const QUIZ_PASS_PERCENT = 80
type StandardsCard = {
  title: string
  subtitle?: string
  body: string[]
}

const STANDARDS_CARDS: StandardsCard[] = [
  {
    title: 'MaidHive Cleaning Standards',
    subtitle: 'This takes about 1 minute to complete.',
    body: [
      'These standards help you:',
      'Get better reviews',
      'Avoid problems',
      'Get more bookings',
      'Cleaners who follow these standards usually get better ratings and more bookings.',
    ],
  },
  {
    title: 'Be on time',
    body: [
      'Arrive at the scheduled time',
      'You can arrive up to 15 minutes early',
      'You have a 15-minute grace period',
      'If you are late or don’t arrive, it may affect your account and future bookings.',
    ],
  },
  {
    title: 'Work to a good standard',
    body: [
      'Clean properly and carefully',
      'Focus on the areas the client listed',
      'Do not rush or leave obvious areas dirty',
      'If work is incomplete, it may lead to complaints or lower ratings.',
    ],
  },
  {
    title: 'Follow the job notes',
    body: [
      'Always read the job description before starting',
      'Focus on the tasks listed by the client',
      'If something is not listed:',
      'Use your judgment',
      'Prioritise important areas (kitchen, bathrooms, floors)',
    ],
  },
  {
    title: 'If you run out of time',
    body: [
      'Complete the most important tasks first',
      'Focus on doing a good job rather than rushing',
      'It is better to:',
      'Do fewer things properly',
      'Than everything poorly',
    ],
  },
  {
    title: 'Communication',
    body: [
      'Be polite and respectful',
      'Keep communication simple and clear',
      'Use chat only for booking-related communication',
    ],
  },
  {
    title: 'Cancellations and reliability',
    body: [
      'Only accept bookings you can attend',
      'Avoid last-minute cancellations',
      'Important:',
      'Repeated cancellations or no-shows may affect your account',
      'Serious issues can lead to removal from the platform',
    ],
  },
  {
    title: 'Respect the client’s home',
    body: [
      'Treat the home with care',
      'Do not use items without permission',
      'Do not bring extra people',
      'Serious issues may lead to account suspension.',
    ],
  },
  {
    title: 'Cleaning supplies',
    body: [
      'Be clear if you bring your own supplies',
      'Or if the client needs to provide them',
    ],
  },
  {
    title: 'Using the app',
    body: [
      'Start and complete jobs in the app when possible',
      'This helps track your performance',
      'If you do not have internet access, you can still complete the job and update the status later.',
    ],
  },
]

const STANDARDS_QUIZ = [
  {
    id: 'q1',
    question: 'What should you do if you are running out of time?',
    options: [
      'Try to rush everything quickly',
      'Focus on the most important tasks and do them properly',
      'Leave early',
    ],
    answer: 1, // B
  },
  {
    id: 'q2',
    question: 'If the client did not list specific tasks, what should you do?',
    options: [
      'Do nothing',
      'Decide yourself and focus on important areas',
      'Cancel the job',
    ],
    answer: 1, // B
  },
  {
    id: 'q3',
    question: 'When should you arrive for a booking?',
    options: [
      'Anytime during the day',
      'At the scheduled time (up to 15 minutes early or within 15 minutes)',
      '1 hour late is fine',
    ],
    answer: 1, // B
  },
  {
    id: 'q4',
    question: 'When can you cancel a booking?',
    options: [
      'Anytime, it doesn’t matter',
      'Only if necessary, and avoid last-minute cancellations',
      'After arriving',
    ],
    answer: 1, // B
  },
  {
    id: 'q5',
    question: 'What happens if you repeatedly cancel or don’t show up?',
    options: [
      'Nothing',
      'It may affect your account or remove you from the platform',
      'You get more jobs',
    ],
    answer: 1, // B
  },
] as const
const BIO_MAX_CHARS = 1000
const MIN_HOURLY_RATE = 6
const MAX_HOURLY_RATE = 20
const IMAGE_FILE_EXT_REGEX = /\.(png|jpe?g|webp|gif|bmp|svg)(?:[?#].*)?$/i
const STANDARDS_TOTAL_STEPS = 9

function isImageDocumentUrl(url: string) {
  return IMAGE_FILE_EXT_REGEX.test(url)
}

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
  const [cleaningSupplies, setCleaningSupplies] = useState<'own_supplies' | 'client_supplies' | ''>('')

  const [transportMode, setTransportMode] = useState('')
  const [pickupLocation, setPickupLocation] = useState('')
  const [idType, setIdType] = useState('')
  const [idFileName, setIdFileName] = useState('')
  const [idFileUrl, setIdFileUrl] = useState('')
  const [uploadingKyc, setUploadingKyc] = useState(false)
  const [petComfortable, setPetComfortable] = useState<boolean | null>(null)
  const [workEligibilityAnswer, setWorkEligibilityAnswer] = useState<boolean | null>(null)
  const [workEligibilityConfirmed, setWorkEligibilityConfirmed] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)

  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [quizScore, setQuizScore] = useState<number | null>(null)
  const [quizPassed, setQuizPassed] = useState(false)
  const [standardsCompleted, setStandardsCompleted] = useState(false)
  const [step5Mode, setStep5Mode] = useState<'standards' | 'confirmation' | 'quiz' | 'success'>('standards')
  const [standardsCardIndex, setStandardsCardIndex] = useState(0)
  const [standardsConfirmChecked, setStandardsConfirmChecked] = useState(false)
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0)
  const [quizFailNotice, setQuizFailNotice] = useState('')

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
      setCleaningSupplies(c.cleaning_supplies ?? c.cleaningSupplies ?? '')

      setTransportMode(c.transport_mode ?? c.transportMode ?? '')
      setPickupLocation(c.transport_pickup_location ?? c.transportPickupLocation ?? '')
      setIdType(c.id_type ?? c.idType ?? '')
      setIdFileName(c.id_file_name ?? c.idFileName ?? '')
      setIdFileUrl(c.id_file_url ?? c.idFileUrl ?? '')
      setPetComfortable(
        (c.pet_comfortable ?? c.petComfortable) === null || (c.pet_comfortable ?? c.petComfortable) === undefined
          ? null
          : Boolean(c.pet_comfortable ?? c.petComfortable),
      )
      setWorkEligibilityAnswer(
        (c.work_eligibility_answer ?? c.workEligibilityAnswer) === null || (c.work_eligibility_answer ?? c.workEligibilityAnswer) === undefined
          ? null
          : Boolean(c.work_eligibility_answer ?? c.workEligibilityAnswer),
      )
      setWorkEligibilityConfirmed(Boolean(c.work_eligibility_confirmed ?? c.workEligibilityConfirmed))
      setTermsAccepted(Boolean(c.terms_accepted ?? c.termsAccepted))
      const existingScore = c.cleaning_quiz_score ?? c.cleaningQuizScore ?? null
      setQuizScore(existingScore)
      const existingPassed = Boolean(c.quiz_passed ?? c.quizPassed ?? (existingScore !== null && Number(existingScore) >= QUIZ_PASS_PERCENT))
      setQuizPassed(existingPassed)
      const existingStandardsCompleted = Boolean(c.standards_completed ?? c.standardsCompleted ?? c.cleaning_standards_accepted ?? c.cleaningStandardsAccepted)
      setStandardsCompleted(existingStandardsCompleted)

      if (onboarding.current_step === 5) {
        if (existingPassed) {
          setStep5Mode('success')
        } else if (existingStandardsCompleted) {
          setStep5Mode('quiz')
        } else {
          setStep5Mode('standards')
        }
      }

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
    if (skills.length === 0) return toast.error('Select at least one service.')
    if (!cleaningSupplies) return toast.error('Cleaning supplies preference is required.')

    setSaving(true)
    try {
      const res = await cleanersApi.updateMyOnboarding({
        ...(profileImage ? { profile_image_url: profileImage } : {}),
        bio,
        hourly_rate: Number(hourlyRate),
        skills,
        cleaning_supplies: cleaningSupplies,
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
    if (petComfortable === null) return toast.error('Please answer the pets question.')
    if (workEligibilityAnswer !== true) return toast.error('You must be legally allowed to work independently in Cyprus.')
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
        pet_comfortable: petComfortable,
        work_eligibility_answer: workEligibilityAnswer,
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

  async function completeStripeStep() {
    if (saving) return
    setSaving(true)
    try {
      const res = await cleanersApi.updateMyOnboarding({
        onboarding_step: 5,
        onboarding_skipped_step4: !stripeConnected,
      })
      setCleaner(res.data?.cleaner ?? cleaner)
      setProgress(res.data?.onboarding ?? progress)
      setStep(5)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to continue.')
    } finally {
      setSaving(false)
    }
  }

  function handleStandardsContinue() {
    if (standardsCardIndex < STANDARDS_CARDS.length - 1) {
      setStandardsCardIndex((prev) => prev + 1)
      return
    }
    setStep5Mode('confirmation')
  }

  async function continueToQuiz() {
    if (saving || !standardsConfirmChecked) return
    setSaving(true)
    try {
      await cleanersApi.updateMyOnboarding({
        onboarding_step: 5,
        onboarding_skipped_step4: false,
        cleaning_standards_accepted: true,
        standards_completed: true,
      })
      setStandardsCompleted(true)
      setStep5Mode('quiz')
      setQuizFailNotice('')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save standards confirmation.')
    } finally {
      setSaving(false)
    }
  }

  function answerQuizQuestion(optionIndex: number) {
    const current = STANDARDS_QUIZ[quizQuestionIndex]
    setQuizAnswers((prev) => ({ ...prev, [current.id]: optionIndex }))
  }

  async function continueQuiz() {
    const current = STANDARDS_QUIZ[quizQuestionIndex]
    if (typeof quizAnswers[current.id] !== 'number') return
    if (quizQuestionIndex < STANDARDS_QUIZ.length - 1) {
      setQuizQuestionIndex((prev) => prev + 1)
      return
    }

    const correct = STANDARDS_QUIZ.reduce((count, q) => (quizAnswers[q.id] === q.answer ? count + 1 : count), 0)
    const score = Math.round((correct / STANDARDS_QUIZ.length) * 100)
    const passed = correct >= 4
    setQuizScore(score)
    setQuizPassed(passed)

    if (!passed) {
      setQuizFailNotice('Please review the standards and try again.')
      setQuizQuestionIndex(0)
      setQuizAnswers({})
      toast.error('Please review the standards and try again.')
      return
    }

    setSaving(true)
    try {
      await cleanersApi.updateMyOnboarding({
        onboarding_step: 5,
        onboarding_skipped_step4: false,
        standards_completed: true,
        quiz_passed: true,
        quiz_score: score,
        cleaning_standards_accepted: true,
        cleaning_quiz_score: score,
      })
      setStep5Mode('success')
      setQuizFailNotice('')
      toast.success('You’re all set. You can now submit your profile for review.')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save quiz results.')
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
      window.location.assign(url)
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
                <Label className="text-sm font-medium">Services you offer <span className="text-red-500">*</span></Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SERVICE_OPTIONS.map((skill) => {
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

              <div>
                <Label className="text-sm font-medium">Cleaning supplies <span className="text-red-500">*</span></Label>
                <div className="mt-2 grid gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="cleaning-supplies"
                      checked={cleaningSupplies === 'own_supplies'}
                      onChange={() => setCleaningSupplies('own_supplies')}
                    />
                    I bring my own supplies
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="cleaning-supplies"
                      checked={cleaningSupplies === 'client_supplies'}
                      onChange={() => setCleaningSupplies('client_supplies')}
                    />
                    Client must provide supplies
                  </label>
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
                <p className="mt-1 text-xs text-gray-500">This helps clients understand how you travel to jobs.</p>
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
                <p className="mt-1 text-xs text-gray-500">Upload a valid government-issued ID (required for approval).</p>
                <div className="mt-2 space-y-2">
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
                  {(idFileName || idFileUrl) && (
                    <div className="rounded-lg border border-slate-200 bg-white p-2">
                      <p className="text-xs font-medium text-slate-700">Current file</p>
                      {idFileUrl ? (
                        <div className="mt-2 flex items-center gap-3">
                          {isImageDocumentUrl(idFileUrl) ? (
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
                            {idFileName || 'View uploaded KYC document'}
                          </a>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-slate-600">{idFileName}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-sm font-medium text-gray-800">Are you comfortable working in homes with pets? <span className="text-red-500">*</span></p>
                  <p className="mt-1 text-xs text-gray-500">You may still receive requests where pets are present.</p>
                  <div className="mt-2 flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="radio" name="pet-comfort" checked={petComfortable === true} onChange={() => setPetComfortable(true)} />
                      Yes
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="radio" name="pet-comfort" checked={petComfortable === false} onChange={() => setPetComfortable(false)} />
                      No
                    </label>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-sm font-medium text-gray-800">Are you legally allowed to work in Cyprus and provide cleaning services independently? <span className="text-red-500">*</span></p>
                  <p className="mt-1 text-xs text-gray-500">If your work permit only allows you to work for one employer, you cannot use MaidHive.</p>
                  <div className="mt-2 flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="radio" name="work-eligibility" checked={workEligibilityAnswer === true} onChange={() => setWorkEligibilityAnswer(true)} />
                      Yes
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="radio" name="work-eligibility" checked={workEligibilityAnswer === false} onChange={() => setWorkEligibilityAnswer(false)} />
                      No
                    </label>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={workEligibilityConfirmed} onChange={(e) => setWorkEligibilityConfirmed(e.target.checked)} />
                  I confirm that I am legally allowed to work in Cyprus and provide cleaning services independently, and I am not restricted to working for a single employer. <span className="text-red-500">*</span>
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
                  <p className="text-sm font-medium text-amber-700 mt-1">You must connect Stripe to receive payouts.</p>
                  <a href="https://stripe.com/connect" target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary hover:underline">Click here to learn more.</a>
                </div>
                <Button onClick={connectStripe} variant="outline">{stripeConnected ? 'Manage Stripe' : 'Connect with Stripe'}</Button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-600">
                You can continue now and connect Stripe later. Stripe is required before you can accept bookings and confirm jobs.
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
                <Button onClick={completeStripeStep} loading={saving}>Continue to standards quiz</Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {step5Mode === 'quiz' || step5Mode === 'success'
                    ? 'Step 2 of 2: Quiz'
                    : 'Step 1 of 2: Cleaning Standards'}
                </p>
              </div>

              {step5Mode === 'standards' && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  {standardsCardIndex > 0 && (
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Step {standardsCardIndex} of {STANDARDS_TOTAL_STEPS}
                    </p>
                  )}
                  <p className="text-lg font-semibold text-slate-900">{STANDARDS_CARDS[standardsCardIndex].title}</p>
                  {STANDARDS_CARDS[standardsCardIndex].subtitle && (
                    <p className="text-sm text-slate-600">{STANDARDS_CARDS[standardsCardIndex].subtitle}</p>
                  )}
                  <div className="space-y-2 text-sm text-slate-700">
                    {STANDARDS_CARDS[standardsCardIndex].body.map((line, idx) => (
                      <p key={`${standardsCardIndex}-${idx}`}>{line}</p>
                    ))}
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={handleStandardsContinue} className="gap-1.5">
                      Continue <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {step5Mode === 'confirmation' && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <p className="text-lg font-semibold text-slate-900">Confirmation</p>
                  <p className="text-sm text-slate-700">
                    I confirm that I have read and understand the MaidHive Cleaning Standards and agree to follow them when accepting bookings.
                  </p>
                  <p className="text-sm text-slate-700">MaidHive is a marketplace.</p>
                  <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                    <li>You are an independent cleaner</li>
                    <li>You are responsible for your work and behaviour</li>
                  </ul>
                  <p className="text-sm text-slate-700">Failure to follow these standards may affect:</p>
                  <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                    <li>Your ratings</li>
                    <li>Your ability to receive bookings</li>
                    <li>Your account status</li>
                  </ul>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={standardsConfirmChecked}
                      onChange={(event) => setStandardsConfirmChecked(event.target.checked)}
                    />
                    I understand and agree
                  </label>
                  <div className="flex justify-end pt-2">
                    <Button onClick={continueToQuiz} disabled={!standardsConfirmChecked} loading={saving}>
                      Continue to quiz
                    </Button>
                  </div>
                </div>
              )}

              {step5Mode === 'quiz' && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  {quizFailNotice && (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                      {quizFailNotice}
                    </p>
                  )}
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Question {quizQuestionIndex + 1} of {STANDARDS_QUIZ.length}
                  </p>
                  <p className="text-base font-semibold text-slate-900">{STANDARDS_QUIZ[quizQuestionIndex].question}</p>
                  <div className="space-y-2">
                    {STANDARDS_QUIZ[quizQuestionIndex].options.map((opt, idx) => (
                      <label
                        key={`${STANDARDS_QUIZ[quizQuestionIndex].id}-${idx}`}
                        className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm text-slate-700"
                      >
                        <input
                          type="radio"
                          name={STANDARDS_QUIZ[quizQuestionIndex].id}
                          checked={quizAnswers[STANDARDS_QUIZ[quizQuestionIndex].id] === idx}
                          onChange={() => answerQuizQuestion(idx)}
                          className="mt-1"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={continueQuiz}
                      disabled={typeof quizAnswers[STANDARDS_QUIZ[quizQuestionIndex].id] !== 'number'}
                      loading={saving}
                    >
                      {quizQuestionIndex === STANDARDS_QUIZ.length - 1 ? 'Finish quiz' : 'Continue'}
                    </Button>
                  </div>
                </div>
              )}

              {step5Mode === 'success' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                  <p className="text-sm font-semibold text-emerald-900">
                    You’re all set. You can now submit your profile for review.
                  </p>
                  <p className="text-xs text-emerald-800">
                    Quiz score: {quizScore ?? 0}% {quizPassed ? '— passed' : ''}
                  </p>
                  <div className="flex justify-end pt-2">
                    <Button onClick={() => router.push('/cleaner/dashboard')}>Go to dashboard</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {progress && progress.completion_pct < 100 && (
        <p className="text-xs text-gray-600 mt-3 text-center">
          Your profile is {progress.completion_pct}% complete. Cleaner profiles are visible to clients only after admin approval.
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
