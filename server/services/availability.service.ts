import { availabilityRepo } from '../repositories/availability.repo'
import { bookingRepo } from '../repositories/booking.repo'

interface TimeSlot {
  start: string // ISO string
  end: string
  disabled: boolean
}

const SLOT_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

export const availabilityService = {
  /**
   * Returns 30-minute interval slots for a given cleaner on a given date.
   *
   * Each slot represents a possible start time. Slots are generated at 30-min
   * intervals from the start of each schedule window to (end - 30min).
   *
   * A slot is marked `disabled: true` when:
   *  - The selected duration would overflow past the schedule window end
   *  - There is a conflict with a blocked time or existing booking
   */
  async getAvailableSlots(
    cleanerId: string,
    dateStr: string,
    durationHours: number,
  ): Promise<TimeSlot[]> {
    const date = new Date(dateStr + 'T00:00:00Z')
    const dayOfWeek = isoWeekday(date) // 1=Mon...7=Sun

    const [schedules, blockedTimes, existingBookings] = await Promise.all([
      availabilityRepo.getSchedule(cleanerId),
      availabilityRepo.getBlockedTimesInRange(cleanerId, startOfDay(date), endOfDay(date)),
      bookingRepo.findActiveForCleaner(cleanerId, startOfDay(date), endOfDay(date)),
    ])

    const daySchedules = schedules
      .filter((s) => s.dayOfWeek === dayOfWeek && s.isActive)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))

    if (daySchedules.length === 0) return []

    const durationMs = durationHours * 60 * 60 * 1000
    const allSlots: TimeSlot[] = []

    for (const schedule of daySchedules) {
      const [startH, startM] = schedule.startTime.split(':').map(Number)
      const [endH, endM] = schedule.endTime.split(':').map(Number)

      const windowStart = new Date(date)
      windowStart.setUTCHours(startH, startM, 0, 0)

      const windowEnd = new Date(date)
      windowEnd.setUTCHours(endH, endM, 0, 0)

      // Generate 30-min interval slots from window start to (window end - 30min)
      let cursor = windowStart.getTime()
      const lastSlotTime = windowEnd.getTime() - SLOT_INTERVAL_MS

      while (cursor <= lastSlotTime) {
        const slotStart = new Date(cursor)
        const slotEnd = new Date(cursor + durationMs)

        // Check if the duration overflows past the schedule window
        const overflows = slotEnd.getTime() > windowEnd.getTime()

        // Check conflicts with blocked times and existing bookings
        const hasConflict = !overflows && (
          blockedTimes.some(
            (b) => b.startDatetime < slotEnd && b.endDatetime > slotStart,
          ) ||
          existingBookings.some(
            (b) => b.scheduledStart < slotEnd && b.scheduledEnd > slotStart,
          )
        )

        allSlots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          disabled: overflows || hasConflict,
        })

        cursor += SLOT_INTERVAL_MS
      }
    }

    // Deduplicate (in case of overlapping schedule windows)
    const uniqueSlots = new Map<string, TimeSlot>()
    for (const slot of allSlots) {
      const key = slot.start
      const existing = uniqueSlots.get(key)
      // Keep the "enabled" version if any window allows it
      if (!existing || (!slot.disabled && existing.disabled)) {
        uniqueSlots.set(key, slot)
      }
    }
    return Array.from(uniqueSlots.values())
  },
}

function isoWeekday(date: Date): number {
  const d = date.getUTCDay() // 0=Sun...6=Sat
  return d === 0 ? 7 : d
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(23, 59, 59, 999)
  return d
}
