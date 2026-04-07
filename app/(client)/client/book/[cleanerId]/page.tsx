'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CalendarDays, Clock } from 'lucide-react'
import { cleanersApi, bookingsApi, availabilityApi } from '@/lib/api'
import { PriceBreakdownCard } from '@/components/price-breakdown-card'
import { LoadingSpinner } from '@/components/loading-spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { CleanerRead, PriceBreakdown } from '@/types'
import { toast } from 'sonner'

const SERVICE_TYPES = [
  { value: 'standard', label: 'Standard Clean' },
  { value: 'deep_clean', label: 'Deep Clean' },
  { value: 'end_of_tenancy', label: 'End of Tenancy' },
  { value: 'move_in', label: 'Move-in Clean' },
]

const DURATION_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8]

export default function BookingFormPage() {
  const { cleanerId } = useParams<{ cleanerId: string }>()
  const router = useRouter()

  const [cleaner, setCleaner] = useState<CleanerRead | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [serviceType, setServiceType] = useState('standard')
  const [date, setDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [duration, setDuration] = useState(2)
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postcode, setPostcode] = useState('')
  const [notes, setNotes] = useState('')

  // Derived
  const [slots, setSlots] = useState<{ start: string; end: string }[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null)

  useEffect(() => {
    cleanersApi.getById(cleanerId)
      .then(r => setCleaner(r.data ?? null))
      .catch(() => toast.error('Failed to load cleaner'))
      .finally(() => setLoading(false))
  }, [cleanerId])

  // Fetch available slots when date or duration changes
  useEffect(() => {
    if (!date || !cleanerId) return
    setSlotsLoading(true)
    setSelectedSlot('')
    availabilityApi.getSlots(cleanerId, `${date}T00:00:00Z`, duration)
      .then(r => setSlots(r.data))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [date, duration, cleanerId])

  // Fetch price breakdown when duration changes
  useEffect(() => {
    if (!cleanerId) return
    bookingsApi.previewPrice(cleanerId, duration)
      .then(r => setBreakdown(r.data ?? null))
      .catch(() => {})
  }, [duration, cleanerId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSlot) { toast.error('Please select a time slot.'); return }
    if (!address || !city || !postcode) { toast.error('Please fill in the address fields.'); return }

    setSubmitting(true)
    try {
      const res = await bookingsApi.create({
        cleaner_id: cleanerId,
        service_type: serviceType as any,
        address,
        city,
        postcode,
        scheduled_start: selectedSlot,
        duration_hours: duration,
        special_instructions: notes || undefined,
      })
      const bookingId = res.data?.id
      toast.success('Booking request sent! Waiting for cleaner to accept.')
      router.push(`/client/bookings/${bookingId}`)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create booking')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingSpinner />
  if (!cleaner) return <div className="text-center py-16 text-muted-foreground">Cleaner not found.</div>

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Book a cleaner</h1>
      <p className="text-muted-foreground mb-6">
        Rate: <strong>{formatCurrency(cleaner.hourly_rate)}/hr</strong>
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Service type */}
        <Card>
          <CardHeader><CardTitle>Service details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Service type</Label>
              <Select
                value={serviceType}
                onChange={e => setServiceType(e.target.value)}
                className="mt-1"
              >
                {SERVICE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </div>
            <div>
              <Label>Duration</Label>
              <Select
                value={String(duration)}
                onChange={e => setDuration(Number(e.target.value))}
                className="mt-1"
              >
                {DURATION_OPTIONS.map(d => (
                  <option key={d} value={d}>{d}h — {breakdown ? formatCurrency(cleaner.hourly_rate * d) : '...'}</option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Date & time */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />Date & time</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Select date</Label>
              <Input
                type="date"
                value={date}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setDate(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            {date && (
              <div>
                <Label>Available time slots</Label>
                {slotsLoading ? (
                  <p className="text-sm text-muted-foreground mt-2">Loading slots…</p>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-2">No available slots on this date.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {slots.map(slot => {
                      const time = new Date(slot.start).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => setSelectedSlot(slot.start)}
                          className={`border rounded-md py-2 text-sm font-medium transition-colors ${
                            selectedSlot === slot.start
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'hover:bg-muted'
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
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader><CardTitle>Job address</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Street address</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main Street" className="mt-1" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City</Label>
                <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Dublin" className="mt-1" required />
              </div>
              <div>
                <Label>Postcode</Label>
                <Input value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="D01 AB12" className="mt-1" required />
              </div>
            </div>
            <div>
              <Label>Special instructions (optional)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Please focus on the kitchen and bathrooms..."
                className="mt-1"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Price */}
        {breakdown && <PriceBreakdownCard breakdown={breakdown} />}

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Request booking
        </Button>
      </form>
    </div>
  )
}
