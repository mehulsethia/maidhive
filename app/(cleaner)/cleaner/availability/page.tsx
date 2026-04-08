'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Clock, Info, CheckCircle2 } from 'lucide-react'
import { availabilityApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ListPageSkeleton } from '@/components/page-skeletons'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

const DAYS = [
  { value: 1, label: 'Monday',    short: 'Mon' },
  { value: 2, label: 'Tuesday',   short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday',  short: 'Thu' },
  { value: 5, label: 'Friday',    short: 'Fri' },
  { value: 6, label: 'Saturday',  short: 'Sat' },
  { value: 7, label: 'Sunday',    short: 'Sun' },
]

const BUFFER_OPTIONS = [0, 15, 30, 45, 60]

type DaySchedule = {
  day_of_week: number
  start_time: string   // "HH:MM"
  end_time: string
  buffer_minutes: number
  enabled: boolean
}

type BlockedTime = {
  id: string
  start_datetime: string
  end_datetime: string
  reason?: string
}

const DEFAULT_SCHEDULE: DaySchedule[] = DAYS.map(d => ({
  day_of_week: d.value,
  start_time: '09:00',
  end_time: '17:00',
  buffer_minutes: 30,
  enabled: d.value <= 5,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60).toString().padStart(2, '0')
  const min = (m % 60).toString().padStart(2, '0')
  return `${h}:${min}`
}

function computeCapacity(day: DaySchedule, jobHours = 2): number {
  if (!day.enabled) return 0
  const total = timeToMinutes(day.end_time) - timeToMinutes(day.start_time)
  if (total <= 0) return 0
  const slot = jobHours * 60 + day.buffer_minutes
  return Math.floor(total / slot)
}

/** Render a mini bar chart of the day's working window on a 24h scale */
function DayBar({ day }: { day: DaySchedule }) {
  if (!day.enabled) return <div className="h-3 w-full rounded bg-muted" />
  const start = (timeToMinutes(day.start_time) / (24 * 60)) * 100
  const width = ((timeToMinutes(day.end_time) - timeToMinutes(day.start_time)) / (24 * 60)) * 100
  return (
    <div className="relative h-3 w-full rounded bg-muted overflow-hidden">
      <div
        className="absolute h-full rounded bg-primary/70"
        style={{ left: `${start}%`, width: `${Math.max(width, 2)}%` }}
      />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AvailabilityPage() {
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE)
  const [blocked, setBlocked] = useState<BlockedTime[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [blockDialog, setBlockDialog] = useState(false)
  const [addingBlock, setAddingBlock] = useState(false)
  const [newBlock, setNewBlock] = useState({ start: '', end: '', reason: '' })

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [schedRes, blockedRes] = await Promise.all([
        availabilityApi.getMySchedule(),
        availabilityApi.getMyBlocked(),
      ])

      if (schedRes.data && schedRes.data.length > 0) {
        const existing = schedRes.data as any[]
        setSchedule(DAYS.map(d => {
          const s = existing.find((e: any) => e.day_of_week === d.value)
          return s
            ? { day_of_week: d.value, start_time: s.start_time, end_time: s.end_time, buffer_minutes: s.buffer_minutes, enabled: s.is_active }
            : { day_of_week: d.value, start_time: '09:00', end_time: '17:00', buffer_minutes: 30, enabled: false }
        }))
      }

      if (blockedRes.data) {
        setBlocked(blockedRes.data as BlockedTime[])
      }
    } catch {
      toast.error('Failed to load availability settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Update field ─────────────────────────────────────────────────────────────
  function update(dayOfWeek: number, field: keyof DaySchedule, value: any) {
    setSchedule(prev => prev.map(d => {
      if (d.day_of_week !== dayOfWeek) return d
      const updated = { ...d, [field]: value }
      // Auto-correct: end must be after start
      if (field === 'start_time' && timeToMinutes(value) >= timeToMinutes(updated.end_time)) {
        updated.end_time = minutesToTime(timeToMinutes(value) + 60)
      }
      return updated
    }))
    setSaved(false)
  }

  // ── Apply preset ──────────────────────────────────────────────────────────────
  function applyPreset(preset: 'weekdays' | 'all' | 'clear') {
    setSchedule(prev => prev.map(d => ({
      ...d,
      enabled: preset === 'clear' ? false : preset === 'all' ? true : d.day_of_week <= 5,
    })))
    setSaved(false)
  }

  // ── Copy to all enabled days ─────────────────────────────────────────────────
  function copyToAll(sourceDay: number) {
    const source = schedule.find(d => d.day_of_week === sourceDay)
    if (!source) return
    setSchedule(prev => prev.map(d =>
      d.enabled && d.day_of_week !== sourceDay
        ? { ...d, start_time: source.start_time, end_time: source.end_time, buffer_minutes: source.buffer_minutes }
        : d
    ))
    toast.success('Hours copied to all working days.')
  }

  // ── Save schedule ────────────────────────────────────────────────────────────
  async function saveSchedule() {
    // Validate
    for (const day of schedule.filter(d => d.enabled)) {
      if (timeToMinutes(day.end_time) <= timeToMinutes(day.start_time)) {
        const label = DAYS.find(d => d.value === day.day_of_week)?.label
        toast.error(`${label}: end time must be after start time.`)
        return
      }
    }

    setSaving(true)
    try {
      const payload = schedule
        .filter(d => d.enabled)
        .map(({ enabled, ...d }) => ({ ...d, is_active: true }))
      await availabilityApi.setMySchedule(payload)
      setSaved(true)
      toast.success('Availability saved!')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  // ── Blocked times ────────────────────────────────────────────────────────────
  async function addBlock() {
    if (!newBlock.start || !newBlock.end) { toast.error('Please set start and end.'); return }
    if (new Date(newBlock.end) <= new Date(newBlock.start)) {
      toast.error('End must be after start.'); return
    }
    setAddingBlock(true)
    try {
      const res = await availabilityApi.addBlocked({
        start_datetime: new Date(newBlock.start).toISOString(),
        end_datetime: new Date(newBlock.end).toISOString(),
        reason: newBlock.reason || undefined,
      })
      setBlocked(b => [...b, res.data as BlockedTime])
      setBlockDialog(false)
      setNewBlock({ start: '', end: '', reason: '' })
      toast.success('Time blocked.')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add block.')
    } finally {
      setAddingBlock(false)
    }
  }

  async function removeBlock(id: string) {
    try {
      await availabilityApi.deleteBlocked(id)
      setBlocked(b => b.filter(bl => bl.id !== id))
      toast.success('Block removed.')
    } catch {
      toast.error('Failed to remove block.')
    }
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  const activeDays = schedule.filter(d => d.enabled)
  const totalCapacity2h = activeDays.reduce((sum, d) => sum + computeCapacity(d, 2), 0)
  const totalCapacity3h = activeDays.reduce((sum, d) => sum + computeCapacity(d, 3), 0)

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) return <ListPageSkeleton />

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="marketplace-title text-2xl text-slate-900">Availability</h1>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>

      <Tabs defaultValue="schedule">
        <TabsList className="w-full">
          <TabsTrigger value="schedule" className="flex-1">Weekly schedule</TabsTrigger>
          <TabsTrigger value="blocked" className="flex-1">
            Blocked times
            {blocked.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">{blocked.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
        </TabsList>

        {/* ── SCHEDULE TAB ─────────────────────────────────────────────── */}
        <TabsContent value="schedule" className="space-y-4">

          {/* Stats banner */}
          {activeDays.length > 0 && (
            <div className="flex gap-3 text-sm flex-wrap">
              <div className="flex items-center gap-1.5 bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span><strong>{activeDays.length}</strong> working day{activeDays.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-green-800">
                Up to <strong className="mx-1">{totalCapacity2h}</strong> 2h jobs or <strong className="mx-1">{totalCapacity3h}</strong> 3h jobs per week
              </div>
            </div>
          )}

          {/* Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Quick set:</span>
            {[
              { key: 'weekdays', label: 'Mon–Fri' },
              { key: 'all',      label: 'Every day' },
              { key: 'clear',    label: 'Clear all' },
            ].map(p => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key as any)}
                className="text-xs border rounded-md px-2.5 py-1 hover:bg-muted transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Day rows */}
          <Card>
            <CardContent className="p-0 divide-y">
              {schedule.map((day, idx) => {
                const meta = DAYS[idx]
                const cap = computeCapacity(day, 2)
                return (
                  <div key={day.day_of_week} className={cn(
                    'p-4 transition-colors',
                    day.enabled ? 'bg-background' : 'bg-muted/20',
                  )}>
                    {/* Row header */}
                    <div className="flex items-center gap-3 mb-2">
                      {/* Toggle */}
                      <button
                        type="button"
                        onClick={() => { update(day.day_of_week, 'enabled', !day.enabled); setSaved(false) }}
                        className={cn(
                          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          day.enabled ? 'bg-primary' : 'bg-muted-foreground/30',
                        )}
                        aria-label={`Toggle ${meta.label}`}
                      >
                        <span className={cn(
                          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform',
                          day.enabled ? 'translate-x-4' : 'translate-x-0',
                        )} />
                      </button>

                      <span className={cn('w-24 text-sm font-medium', !day.enabled && 'text-muted-foreground')}>
                        {meta.label}
                      </span>

                      {day.enabled ? (
                        <span className="text-xs text-muted-foreground">
                          {cap} × 2h slot{cap !== 1 ? 's' : ''} available
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not working</span>
                      )}
                    </div>

                    {/* Mini timeline bar */}
                    <DayBar day={day} />

                    {/* Time controls */}
                    {day.enabled && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-muted-foreground w-8 shrink-0">From</Label>
                          <Input
                            type="time"
                            value={day.start_time}
                            onChange={e => update(day.day_of_week, 'start_time', e.target.value)}
                            className="h-8 w-28 text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-muted-foreground w-4 shrink-0">To</Label>
                          <Input
                            type="time"
                            value={day.end_time}
                            onChange={e => update(day.day_of_week, 'end_time', e.target.value)}
                            className="h-8 w-28 text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-muted-foreground shrink-0">Gap</Label>
                          <select
                            value={day.buffer_minutes}
                            onChange={e => update(day.day_of_week, 'buffer_minutes', Number(e.target.value))}
                            className="h-8 text-xs border rounded-md px-2 bg-background"
                          >
                            {BUFFER_OPTIONS.map(b => (
                              <option key={b} value={b}>{b === 0 ? 'No gap' : `${b}m gap`}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => copyToAll(day.day_of_week)}
                          className="text-xs text-primary hover:underline ml-auto"
                        >
                          Copy to all
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <div className="flex items-center gap-2">
            <Button onClick={saveSchedule} loading={saving} className="flex-1">
              Save schedule
            </Button>
          </div>

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Gap time is a buffer between jobs for travel and reset. Clients won't be able to book slots that overlap with this buffer.
          </p>
        </TabsContent>

        {/* ── BLOCKED TIMES TAB ────────────────────────────────────────── */}
        <TabsContent value="blocked" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Block off holidays, appointments, or any time you're unavailable.</p>
            <Button size="sm" onClick={() => setBlockDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add block
            </Button>
          </div>

          <Card>
            <CardContent className="p-0 divide-y">
              {blocked.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No blocked times. Clients can book any of your available slots.
                </div>
              ) : (
                blocked
                  .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
                  .map(b => {
                    const start = new Date(b.start_datetime)
                    const end = new Date(b.end_datetime)
                    const isMultiDay = start.toDateString() !== end.toDateString()
                    const isPast = end < new Date()

                    return (
                      <div key={b.id} className={cn('flex items-center gap-3 px-4 py-3', isPast && 'opacity-50')}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                              {start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                              {isMultiDay && ` – ${end.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`}
                            </p>
                            {isPast && <Badge variant="secondary" className="text-[10px]">Past</Badge>}
                          </div>
                          {!isMultiDay && (
                            <p className="text-xs text-muted-foreground">
                              {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {' – '}
                              {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                          {b.reason && <p className="text-xs text-muted-foreground italic mt-0.5">"{b.reason}"</p>}
                        </div>
                        <button
                          onClick={() => removeBlock(b.id)}
                          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Remove block"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })
              )}
            </CardContent>
          </Card>

          {/* Add block dialog */}
          <Dialog open={blockDialog} onClose={() => setBlockDialog(false)}>
            <DialogTitle>Block time off</DialogTitle>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start</Label>
                  <Input
                    type="datetime-local"
                    value={newBlock.start}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={e => setNewBlock(b => ({ ...b, start: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>End</Label>
                  <Input
                    type="datetime-local"
                    value={newBlock.end}
                    min={newBlock.start || new Date().toISOString().slice(0, 16)}
                    onChange={e => setNewBlock(b => ({ ...b, end: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Reason (optional)</Label>
                <Input
                  value={newBlock.reason}
                  onChange={e => setNewBlock(b => ({ ...b, reason: e.target.value }))}
                  placeholder="Holiday, dentist, personal time…"
                  className="mt-1"
                />
              </div>
              {/* Quick-select full days */}
              <div className="flex gap-2 flex-wrap pt-1">
                <span className="text-xs text-muted-foreground self-center">Quick:</span>
                {['Today', 'Tomorrow', 'This weekend'].map(label => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      const now = new Date()
                      let start: Date
                      let end: Date

                      if (label === 'Today') {
                        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0)
                        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0)
                      } else if (label === 'Tomorrow') {
                        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0)
                        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 20, 0)
                      } else {
                        const day = now.getDay()
                        const daysUntilSat = (6 - day + 7) % 7 || 7
                        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSat, 8, 0)
                        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSat + 1, 20, 0)
                      }

                      const fmt = (d: Date) => d.toISOString().slice(0, 16)
                      setNewBlock(b => ({ ...b, start: fmt(start), end: fmt(end) }))
                    }}
                    className="text-xs border rounded-md px-2 py-1 hover:bg-muted"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Button onClick={addBlock} loading={addingBlock} className="w-full mt-2">
                Add block
              </Button>
            </div>
          </Dialog>
        </TabsContent>

        {/* ── PREVIEW TAB ───────────────────────────────────────────────── */}
        <TabsContent value="preview" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This is what your availability looks like to clients booking a 2-hour slot.
          </p>

          <Card>
            <CardContent className="p-4 space-y-3">
              {schedule.map((day, idx) => {
                const meta = DAYS[idx]
                const cap = computeCapacity(day, 2)

                if (!day.enabled) {
                  return (
                    <div key={day.day_of_week} className="flex items-center gap-3">
                      <span className="w-24 text-sm text-muted-foreground">{meta.label}</span>
                      <span className="text-xs text-muted-foreground">Unavailable</span>
                    </div>
                  )
                }

                // Generate preview slots at 30-min intervals
                const startMin = timeToMinutes(day.start_time)
                const endMin = timeToMinutes(day.end_time)
                const slotMin = 2 * 60  // 2 hours
                const slots: string[] = []
                let cursor = startMin
                while (cursor + slotMin <= endMin) {
                  slots.push(minutesToTime(cursor))
                  cursor += 30 // 30-min slot intervals
                }

                return (
                  <div key={day.day_of_week}>
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="w-24 text-sm font-medium">{meta.label}</span>
                      <span className="text-xs text-muted-foreground">{day.start_time} – {day.end_time}</span>
                      <span className="text-xs text-green-700 ml-auto">{cap} slots</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-24">
                      {slots.map(t => (
                        <span
                          key={t}
                          className="text-xs border rounded px-2 py-0.5 bg-primary/5 border-primary/20 text-primary"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Actual availability shown to clients is further filtered by existing bookings and blocked times.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
