'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle } from 'lucide-react'
import { cleanersApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const STEPS = [
  { id: 1, title: 'Profile', description: 'Tell clients about yourself' },
  { id: 2, title: 'Rate & areas', description: 'Set your pricing and locations' },
  { id: 3, title: 'Availability', description: 'Set your working hours' },
  { id: 4, title: 'Stripe payout', description: 'Connect your bank account' },
]

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

type Schedule = {
  day_of_week: number
  start_time: string
  end_time: string
  buffer_minutes: number
  enabled: boolean
}

const DEFAULT_SCHEDULE: Schedule[] = DAYS.map(d => ({
  day_of_week: d.value,
  start_time: '09:00',
  end_time: '17:00',
  buffer_minutes: 30,
  enabled: d.value <= 5,
}))

export default function CleanerOnboarding() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1 state
  const [bio, setBio] = useState('')
  const [experience, setExperience] = useState(0)

  // Step 2 state
  const [hourlyRate, setHourlyRate] = useState(25)
  const [city, setCity] = useState('')
  const [postcode, setPostcode] = useState('')

  // Step 3 state
  const [schedule, setSchedule] = useState<Schedule[]>(DEFAULT_SCHEDULE)

  function updateSchedule(dayOfWeek: number, field: keyof Schedule, value: any) {
    setSchedule(s => s.map(d => d.day_of_week === dayOfWeek ? { ...d, [field]: value } : d))
  }

  async function saveStep1() {
    if (!bio.trim()) { toast.error('Please add a bio.'); return }
    setSaving(true)
    try {
      await cleanersApi.updateMyProfile({ bio, years_experience: experience, hourly_rate: hourlyRate })
      setStep(2)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveStep2() {
    if (!city.trim()) { toast.error('Please enter your city.'); return }
    if (hourlyRate < 15) { toast.error('Minimum hourly rate is €15.'); return }
    setSaving(true)
    try {
      await cleanersApi.updateMyProfile({ bio, years_experience: experience, hourly_rate: hourlyRate })
      // Add service area
      const response = await fetch('/api/v1/cleaners/me/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, postcode_prefix: postcode || undefined }),
      })
      setStep(3)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveStep3() {
    setSaving(true)
    try {
      const activeDays = schedule.filter(d => d.enabled)
      await fetch('/api/v1/availability/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeDays.map(({ enabled, ...d }) => d)),
      })
      setStep(4)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleStripeConnect() {
    toast.info('Stripe Connect onboarding will open in a new window.')
    // In production: redirect to /api/v1/payments/connect/onboard which creates Stripe Connect link
    router.push('/cleaner/dashboard')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Set up your cleaner profile</h1>
      <p className="text-muted-foreground mb-8">Complete all steps to start receiving bookings.</p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 shrink-0">
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
              step === s.id ? 'bg-primary text-primary-foreground' :
              step > s.id ? 'bg-green-100 text-green-700' :
              'bg-muted text-muted-foreground'
            )}>
              {step > s.id
                ? <CheckCircle2 className="h-4 w-4" />
                : <span className="h-5 w-5 flex items-center justify-center rounded-full border-2 text-xs">{s.id}</span>
              }
              {s.title}
            </div>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1 — Profile */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Your profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Bio</Label>
              <Textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell clients about your experience, specialties, and why they should choose you..."
                className="mt-1"
                rows={4}
              />
            </div>
            <div>
              <Label>Years of experience</Label>
              <Input
                type="number"
                min={0}
                value={experience}
                onChange={e => setExperience(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <Button onClick={saveStep1} loading={saving} className="w-full">Continue</Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Rate & areas */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Rate & service area</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Hourly rate (€, min €15)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                <Input
                  type="number"
                  min={15}
                  value={hourlyRate}
                  onChange={e => setHourlyRate(Number(e.target.value))}
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <Label>City you work in</Label>
              <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Dublin" className="mt-1" />
            </div>
            <div>
              <Label>Postcode prefix (optional)</Label>
              <Input value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="D01, D02..." className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button onClick={saveStep2} loading={saving} className="flex-1">Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Availability */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Weekly availability</CardTitle>
            <p className="text-sm text-muted-foreground">Set the days and hours you're available to work.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {schedule.map(day => {
              const dayLabel = DAYS.find(d => d.value === day.day_of_week)?.label
              return (
                <div key={day.day_of_week} className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                  day.enabled ? 'border-primary/30 bg-primary/5' : 'opacity-50'
                )}>
                  <button
                    type="button"
                    onClick={() => updateSchedule(day.day_of_week, 'enabled', !day.enabled)}
                    className={cn(
                      'h-8 w-10 rounded text-xs font-bold shrink-0 transition-colors',
                      day.enabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {dayLabel}
                  </button>
                  {day.enabled && (
                    <>
                      <div className="flex items-center gap-1 flex-1">
                        <Input
                          type="time"
                          value={day.start_time}
                          onChange={e => updateSchedule(day.day_of_week, 'start_time', e.target.value)}
                          className="h-8 text-sm"
                        />
                        <span className="text-muted-foreground text-sm shrink-0">to</span>
                        <Input
                          type="time"
                          value={day.end_time}
                          onChange={e => updateSchedule(day.day_of_week, 'end_time', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground">
                        <select
                          value={day.buffer_minutes}
                          onChange={e => updateSchedule(day.day_of_week, 'buffer_minutes', Number(e.target.value))}
                          className="text-xs border rounded px-1 py-0.5"
                        >
                          {[0, 15, 30, 45, 60].map(b => <option key={b} value={b}>{b}m buffer</option>)}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
              <Button onClick={saveStep3} loading={saving} className="flex-1">Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 — Stripe */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Connect your bank account</CardTitle>
            <p className="text-sm text-muted-foreground">MaidHive uses Stripe to send you payouts after each job.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
              <p>✅ Payouts sent within 24h of job completion</p>
              <p>✅ Bank-level security via Stripe Connect</p>
              <p>✅ Supports most Irish & EU bank accounts</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Back</Button>
              <Button onClick={handleStripeConnect} className="flex-1">Connect with Stripe</Button>
            </div>
            <button
              type="button"
              onClick={() => router.push('/cleaner/dashboard')}
              className="w-full text-sm text-muted-foreground hover:text-foreground text-center"
            >
              Skip for now (you won't receive payouts until connected)
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
