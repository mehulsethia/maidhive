'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Download, Plus, X, Trash2 } from 'lucide-react'
import { availabilityApi, googleCalendarApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { dateOnlyLabel, endOfUtcDate, startOfUtcDate, todayUtcDateOnly, toUtcDateOnly } from '@/lib/datetime'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { toast } from 'sonner'

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

const GAP_MINUTES = 30

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minToTime(m: number): string {
  const h = Math.floor(m / 60)
    .toString()
    .padStart(2, '0')
  const min = (m % 60).toString().padStart(2, '0')
  return `${h}:${min}`
}

function formatTime12(t: string): string {
  const [hh, mm] = t.split(':').map(Number)
  const suffix = hh >= 12 ? 'pm' : 'am'
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
  return `${h12}:${mm.toString().padStart(2, '0')} ${suffix}`
}

function blockedDateLabel(isoDateTime: string): string {
  return dateOnlyLabel(toUtcDateOnly(isoDateTime))
}

/** Generate time options in 30-min intervals (00:00 to 23:30) */
function generateTimeOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = []
  for (let m = 0; m < 24 * 60; m += 30) {
    const val = minToTime(m)
    opts.push({ value: val, label: formatTime12(val) })
  }
  return opts
}

const TIME_OPTIONS = generateTimeOptions()

// ─── Types ───────────────────────────────────────────────────────────────────

type TimeSlot = {
  id: string
  start: string // "HH:MM"
  end: string // "HH:MM"
}

type DaySchedule = {
  dayOfWeek: number
  slots: TimeSlot[]
}

type BlockedDate = {
  id: string
  start_datetime: string
  end_datetime: string
  reason?: string
}

interface ScheduleEditorProps {
  /** If true, shows in compact mode for onboarding (no Google Calendar card, hides internal save button) */
  compact?: boolean
  /** Called after successful save */
  onSave?: () => void
  /** External save handler — if provided, the component calls this instead of the API */
  onSaveExternal?: (
    schedules: Array<{
      day_of_week: number
      start_time: string
      end_time: string
      buffer_minutes: number
      is_active: boolean
    }>,
  ) => Promise<void>
  /** Ref-like callback to expose the save function to the parent */
  saveRef?: React.MutableRefObject<(() => Promise<void>) | null>
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateSlots(slots: TimeSlot[]): string | null {
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]
    const startMin = timeToMin(s.start)
    const endMin = timeToMin(s.end)

    if (endMin <= startMin) {
      return `Slot ${i + 1}: end time must be after start time.`
    }

    if (i > 0) {
      const prevEnd = timeToMin(slots[i - 1].end)
      if (startMin < prevEnd + GAP_MINUTES) {
        return `Slot ${i + 1}: must start at least ${GAP_MINUTES} min after the previous slot ends (${formatTime12(slots[i - 1].end)}).`
      }
    }
  }
  return null
}

// ─── TimeSelect ──────────────────────────────────────────────────────────────

function TimeSelect({
  value,
  onChange,
  min,
  max,
}: {
  value: string
  onChange: (v: string) => void
  min?: string
  max?: string
}) {
  const filtered = useMemo(() => {
    return TIME_OPTIONS.filter((o) => {
      const m = timeToMin(o.value)
      if (min !== undefined && m < timeToMin(min)) return false
      if (max !== undefined && m > timeToMin(max)) return false
      return true
    })
  }, [min, max])

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-[120px] rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-primary/40 focus:ring-2 focus:ring-primary/20 sm:w-[128px]"
    >
      {filtered.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ScheduleEditor({ compact, onSave, onSaveExternal, saveRef }: ScheduleEditorProps) {
  const tab = 'schedule' as const
  const [days, setDays] = useState<DaySchedule[]>(
    DAYS.map((d) => ({
      dayOfWeek: d.value,
      slots:
        d.value <= 5
          ? [{ id: uid(), start: '09:00', end: '17:00' }]
          : [],
    })),
  )
  const [blocked, setBlocked] = useState<BlockedDate[]>([])
  const [blockInput, setBlockInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addingBlocked, setAddingBlocked] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [schedRes, blockedRes] = await Promise.allSettled([
        availabilityApi.getMySchedule(),
        availabilityApi.getMyBlocked(),
      ])

      if (schedRes.status === 'fulfilled' && (schedRes.value.data?.length ?? 0) > 0) {
        const existing = schedRes.value.data as any[]
        const dayMap = new Map<number, TimeSlot[]>()

        for (const s of existing) {
          const dow = s.day_of_week ?? s.dayOfWeek
          const startTime = s.start_time ?? s.startTime
          const endTime = s.end_time ?? s.endTime
          if (!dayMap.has(dow)) dayMap.set(dow, [])
          dayMap.get(dow)!.push({ id: uid(), start: startTime, end: endTime })
        }

        // Sort each day's slots
        for (const [, slots] of dayMap) {
          slots.sort((a, b) => timeToMin(a.start) - timeToMin(b.start))
        }

        setDays(
          DAYS.map((d) => ({
            dayOfWeek: d.value,
            slots: dayMap.get(d.value) ?? [],
          })),
        )
      }

      if (blockedRes.status === 'fulfilled' && blockedRes.value.data) {
        const items = (blockedRes.value.data as any[])
          .map((b) => ({
            id: b.id,
            start_datetime: b.start_datetime ?? b.startDatetime,
            end_datetime: b.end_datetime ?? b.endDatetime,
            reason: b.reason,
          }))
          // Filter out past blocked dates
          .filter((b) => new Date(b.end_datetime) > new Date())
        setBlocked(items)
      }

      if (!compact) {
        const gcalRes = await googleCalendarApi.getStatus().catch(() => null)
        if (gcalRes) {
          setGoogleConnected(Boolean(gcalRes.data?.connected))
        }
      }
      resetLoadError(`schedule-editor-${compact ? 'compact' : 'full'}`)
    } catch {
      reportLoadError(`schedule-editor-${compact ? 'compact' : 'full'}`, 'Failed to load availability.')
    } finally {
      setLoading(false)
    }
  }, [compact])

  useEffect(() => {
    load()
  }, [load])

  // ── Day toggle ────────────────────────────────────────────────────────────
  function toggleDay(dow: number) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dow) return d
        if (d.slots.length > 0) {
          return { ...d, slots: [] }
        }
        return { ...d, slots: [{ id: uid(), start: '09:00', end: '17:00' }] }
      }),
    )
  }

  // ── Add slot ──────────────────────────────────────────────────────────────
  function addSlot(dow: number) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dow) return d
        const lastSlot = d.slots[d.slots.length - 1]
        let newStart = '09:00'
        let newEnd = '12:00'

        if (lastSlot) {
          const lastEndMin = timeToMin(lastSlot.end)
          const gapStart = lastEndMin + GAP_MINUTES
          if (gapStart >= 24 * 60 - 60) {
            toast.error('No room for another slot on this day.')
            return d
          }
          newStart = minToTime(gapStart)
          newEnd = minToTime(Math.min(gapStart + 180, 24 * 60 - 30))
        }

        return { ...d, slots: [...d.slots, { id: uid(), start: newStart, end: newEnd }] }
      }),
    )
  }

  // ── Remove slot (only last allowed) ───────────────────────────────────────
  function removeSlot(dow: number, slotId: string) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dow) return d
        const lastSlot = d.slots[d.slots.length - 1]
        if (!lastSlot || lastSlot.id !== slotId) {
          toast.error('You can only remove the last time slot.')
          return d
        }
        return { ...d, slots: d.slots.slice(0, -1) }
      }),
    )
  }

  // ── Update slot time ──────────────────────────────────────────────────────
  function updateSlot(dow: number, slotId: string, field: 'start' | 'end', value: string) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dow) return d
        const idx = d.slots.findIndex((s) => s.id === slotId)
        if (idx === -1) return d

        const newSlots = [...d.slots]
        const updated = { ...newSlots[idx], [field]: value }

        // Validate: end > start
        if (timeToMin(updated.end) <= timeToMin(updated.start)) {
          if (field === 'start') {
            updated.end = minToTime(Math.min(timeToMin(value) + 60, 24 * 60 - 30))
          } else {
            toast.error('End time must be after start time.')
            return d
          }
        }

        // Validate: no overlap with previous slot
        if (idx > 0 && field === 'start') {
          const prevEnd = timeToMin(newSlots[idx - 1].end)
          if (timeToMin(value) < prevEnd + GAP_MINUTES) {
            toast.error(
              `Start time must be at least ${GAP_MINUTES} min after the previous slot ends.`,
            )
            return d
          }
        }

        // Validate: no overlap with next slot
        if (idx < newSlots.length - 1 && field === 'end') {
          const nextStart = timeToMin(newSlots[idx + 1].start)
          if (timeToMin(value) + GAP_MINUTES > nextStart) {
            toast.error(
              `End time must be at least ${GAP_MINUTES} min before the next slot starts.`,
            )
            return d
          }
        }

        newSlots[idx] = updated
        return { ...d, slots: newSlots }
      }),
    )
  }

  // ── Expose save to parent via ref ─────────────────────────────────────────
  useEffect(() => {
    if (saveRef) saveRef.current = save
  })

  // ── Save schedule ─────────────────────────────────────────────────────────
  async function save() {
    // Validate all days
    for (const d of days) {
      if (d.slots.length === 0) continue
      const err = validateSlots(d.slots)
      if (err) {
        const dayLabel = DAYS.find((dd) => dd.value === d.dayOfWeek)?.label
        toast.error(`${dayLabel}: ${err}`)
        return
      }
    }

    const payload = days.flatMap((d) =>
      d.slots.map((s) => ({
        day_of_week: d.dayOfWeek,
        start_time: s.start,
        end_time: s.end,
        buffer_minutes: GAP_MINUTES,
        is_active: true,
      })),
    )

    setSaving(true)
    try {
      if (onSaveExternal) {
        await onSaveExternal(payload)
      } else {
        await availabilityApi.setMySchedule(payload)
        toast.success('Schedule saved!')
      }
      onSave?.()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save schedule.')
    } finally {
      setSaving(false)
    }
  }

  // ── Block dates ───────────────────────────────────────────────────────────
  async function addBlockedDate() {
    if (addingBlocked) return
    if (!blockInput) {
      toast.error('Select a date to block.')
      return
    }
    const selectedDate = blockInput
    const todayUtc = todayUtcDateOnly()
    if (selectedDate < todayUtc) {
      toast.error('Cannot block past dates.')
      return
    }

    setAddingBlocked(true)
    try {
      const startOfDay = startOfUtcDate(selectedDate)
      const endOfDay = endOfUtcDate(selectedDate)

      const res = await availabilityApi.addBlocked({
        start_datetime: startOfDay.toISOString(),
        end_datetime: endOfDay.toISOString(),
      })
      setBlocked((prev) => [
        ...prev,
        {
          id: (res.data as any)?.id ?? uid(),
          start_datetime: startOfDay.toISOString(),
          end_datetime: endOfDay.toISOString(),
        },
      ])
      setBlockInput('')
      toast.success('Date blocked.')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to block date.')
    } finally {
      setAddingBlocked(false)
    }
  }

  async function removeBlockedDate(id: string) {
    try {
      await availabilityApi.deleteBlocked(id)
      setBlocked((prev) => prev.filter((b) => b.id !== id))
      toast.success('Blocked date removed.')
    } catch {
      toast.error('Failed to remove blocked date.')
    }
  }

  async function connectGoogleCalendar() {
    if (googleBusy) return
    setGoogleBusy(true)
    try {
      const res = await googleCalendarApi.getConnectUrl('/cleaner/profile?tab=availability')
      const url = res.data?.url
      if (!url) throw new Error('Could not start Google Calendar connection.')
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) {
        throw new Error('Please allow popups to connect Google Calendar.')
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to open Google OAuth.')
    } finally {
      setGoogleBusy(false)
    }
  }

  async function disconnectGoogleCalendar() {
    if (googleBusy) return
    setGoogleBusy(true)
    try {
      await googleCalendarApi.disconnect()
      setGoogleConnected(false)
      toast.success('Google Calendar disconnected.')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to disconnect Google Calendar.')
    } finally {
      setGoogleBusy(false)
    }
  }

  // ── Get external state for onboarding ─────────────────────────────────────
  const schedulePayload = useMemo(
    () =>
      days.flatMap((d) =>
        d.slots.map((s) => ({
          day_of_week: d.dayOfWeek,
          start_time: s.start,
          end_time: s.end,
          buffer_minutes: GAP_MINUTES,
          is_active: true,
        })),
      ),
    [days],
  )

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 w-48 rounded-lg bg-slate-100" />
        <div className="h-[400px] rounded-2xl bg-slate-100" />
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4', compact ? '' : 'xl:grid-cols-[minmax(0,1fr)_320px]')}>
      {/* ── Left: Schedule ──────────────────────────────────────────────── */}
      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white">
        {/* Header */}
        <div className="border-b border-slate-100 px-5 pt-4 pb-3">
          <p className="text-sm font-semibold text-slate-900">Schedule</p>
        </div>

        {tab === 'schedule' && (
          <div className="p-5">
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p>Set your general weekly availability. You can update this anytime in your dashboard. Booked time slots will automatically be blocked.</p>
              <p className="mt-1">Use the <span className="font-semibold">+</span> control to add multiple time slots on the same day for split shifts.</p>
            </div>
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Weeks</p>
              {!compact && (
                <Button size="sm" variant="outline" onClick={save} loading={saving}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Save
                </Button>
              )}
            </div>

            {/* Day rows */}
            <div className="space-y-3.5">
              {days.map((d) => {
                const meta = DAYS.find((dd) => dd.value === d.dayOfWeek)!
                const hasSlots = d.slots.length > 0

                return (
                  <div key={d.dayOfWeek} className="flex gap-3">
                    {/* Day circle */}
                    <div className="flex w-12 shrink-0 flex-col items-center pt-1.5">
                      <button
                        type="button"
                        onClick={() => toggleDay(d.dayOfWeek)}
                        className={cn(
                          'flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold transition-all',
                          hasSlots
                            ? 'bg-primary text-white shadow-[0_4px_12px_rgba(99,91,255,0.35)]'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                        )}
                      >
                        {meta.label}
                      </button>
                    </div>

                    {/* Slots */}
                    <div className="min-w-0 flex-1 space-y-2">
                      {!hasSlots ? (
                        <div className="flex h-11 items-center rounded-lg bg-slate-50 px-4">
                          <span className="text-sm text-slate-400">Unavailable</span>
                        </div>
                      ) : (
                        d.slots.map((slot, slotIdx) => {
                          const isLast = slotIdx === d.slots.length - 1

                          return (
                            <div key={slot.id} className="flex flex-wrap items-center gap-2">
                              <TimeSelect
                                value={slot.start}
                                onChange={(v) => updateSlot(d.dayOfWeek, slot.id, 'start', v)}
                              />
                              <span className="text-slate-400">—</span>
                              <TimeSelect
                                value={slot.end}
                                onChange={(v) => updateSlot(d.dayOfWeek, slot.id, 'end', v)}
                              />

                              <div className="ml-0 flex items-center gap-0.5 sm:ml-1">
                                {/* Add button: only on last slot */}
                                {isLast && (
                                  <button
                                    type="button"
                                    onClick={() => addSlot(d.dayOfWeek)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary"
                                    title="Add time slot"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                )}

                                {/* Remove button: only on last slot, only if multiple */}
                                {isLast && d.slots.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeSlot(d.dayOfWeek, slot.id)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                    title="Remove time slot"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}

                                {/* X button: only on last slot if single slot */}
                                {isLast && d.slots.length === 1 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleDay(d.dayOfWeek)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                    title="Mark as unavailable"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>

      {/* ── Right: Block Dates + Google Calendar ────────────────────────── */}
      {!compact && (
        <div className="space-y-4 xl:w-[320px]">
          {/* Block Dates */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-base font-semibold text-slate-900">Block Dates</p>
            <p className="mt-1 text-xs text-slate-500">
              Add dates when you will be unavailable to take calls
            </p>

            <div className="mt-4 space-y-3">
              <Input
                type="date"
                value={blockInput}
                min={todayUtcDateOnly()}
                disabled={addingBlocked}
                onChange={(e) => setBlockInput(e.target.value)}
                placeholder="Select days when you are unavailable"
              />
              <Button className="w-full" onClick={addBlockedDate} loading={addingBlocked}>
                Add unavailable dates
              </Button>
            </div>

            {blocked.length > 0 && (
              <div className="mt-4 space-y-2">
                {blocked
                  .sort(
                    (a, b) =>
                      new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime(),
                  )
                  .map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-600">
                        {blockedDateLabel(b.start_datetime)}
                      </span>
                      <button
                        onClick={() => removeBlockedDate(b.id)}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Google Calendar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-8 w-8 text-primary" />
                <p className="text-sm font-semibold text-slate-900">Google Calendar</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={googleConnected ? disconnectGoogleCalendar : connectGoogleCalendar}
                loading={googleBusy}
              >
                {googleConnected ? 'Disconnect' : 'Connect'}
              </Button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Sync your personal and work calendar to avoid any clashes with your schedule
            </p>
            <p className="mt-2 text-xs font-medium text-slate-700">
              Status: {googleConnected ? 'Connected' : 'Not connected'}
            </p>
            <a
              href="https://workspace.google.com/products/calendar/"
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-xs font-medium text-primary hover:underline"
            >
              Click here to learn more.
            </a>
          </div>
        </div>
      )}

      {/* Compact mode: inline block dates */}
      {compact && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-700">Block Dates (optional)</p>
          <p className="mt-1 text-xs text-slate-500">Block specific future dates</p>
          <div className="mt-3 flex items-center gap-2">
            <Input
              type="date"
              value={blockInput}
              min={todayUtcDateOnly()}
              disabled={addingBlocked}
              onChange={(e) => setBlockInput(e.target.value)}
              className="flex-1"
            />
            <Button size="sm" onClick={addBlockedDate} loading={addingBlocked}>
              Add
            </Button>
          </div>
          {blocked.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {blocked.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs"
                >
                  <span className="text-slate-600">
                    {blockedDateLabel(b.start_datetime)}
                  </span>
                  <button
                    onClick={() => removeBlockedDate(b.id)}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
