import { availabilityRepo } from '../repositories/availability.repo'
import { bookingRepo } from '../repositories/booking.repo'

interface TimeSlot {
  start: string // ISO string
  end: string
  disabled: boolean
}

const SLOT_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes
const APP_TIMEZONE = 'Europe/Nicosia'

/**
 * Get the UTC offset in milliseconds for APP_TIMEZONE at a given instant.
 * Positive = east of UTC (e.g. +3h for EEST).
 */
function tzOffsetMs(date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr = date.toLocaleString('en-US', { timeZone: APP_TIMEZONE })
  return new Date(tzStr).getTime() - new Date(utcStr).getTime()
}

/**
 * Convert a Cyprus local time (dateStr YYYY-MM-DD + hours + minutes) to UTC.
 * Handles DST automatically (EET = UTC+2, EEST = UTC+3).
 */
function cyprusToUTC(dateStr: string, hours: number, minutes: number): Date {
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const asUTC = new Date(`${dateStr}T${hh}:${mm}:00Z`)
  const offset = tzOffsetMs(asUTC)
  return new Date(asUTC.getTime() - offset)
}

/** Today's date string (YYYY-MM-DD) in Cyprus timezone */
function todayInCyprus(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(new Date())
}

export const availabilityService = {
  /**
   * Returns 30-minute interval slots for a given cleaner on a given date.
   *
   * Each slot represents a possible start time. Slots are generated at 30-min
   * intervals from the start of each schedule window to (end - 30min).
   *
   * A slot is marked `disabled: true` when:
   *  - It is within the 2-hour lead time from now
   *  - It starts within the 1-hour buffer before the schedule ends
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

    // Query range covers the full Cyprus day in UTC
    const dayStartUTC = cyprusToUTC(dateStr, 0, 0)
    const dayEndUTC = cyprusToUTC(dateStr, 23, 59)
    dayEndUTC.setUTCSeconds(59, 999)

    const [schedules, blockedTimes, existingBookings] = await Promise.all([
      availabilityRepo.getSchedule(cleanerId),
      availabilityRepo.getBlockedTimesInRange(cleanerId, dayStartUTC, dayEndUTC),
      bookingRepo.findActiveForCleaner(cleanerId, dayStartUTC, dayEndUTC),
    ])

    const daySchedules = schedules
      .filter((s) => s.dayOfWeek === dayOfWeek && s.isActive)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))

    if (daySchedules.length === 0) return []

    const durationMs = durationHours * 60 * 60 * 1000
    const now = Date.now()
    const minBookableStart = now + 2 * 60 * 60 * 1000
    const allSlots: TimeSlot[] = []

    for (const schedule of daySchedules) {
      const [startH, startM] = schedule.startTime.split(':').map(Number)
      const [endH, endM] = schedule.endTime.split(':').map(Number)

      // Schedule times are in Cyprus local time — convert to UTC
      const windowStart = cyprusToUTC(dateStr, startH, startM)
      const windowEnd = cyprusToUTC(dateStr, endH, endM)

      const maxBookableStart = windowEnd.getTime() - 1 * 60 * 60 * 1000

      // Generate 30-min interval slots from window start to (window end - 30min)
      let cursor = windowStart.getTime()
      const windowEndTime = windowEnd.getTime()

      while (cursor + SLOT_INTERVAL_MS <= windowEndTime) {
        const slotStart = new Date(cursor)
        const slotEnd = new Date(cursor + durationMs)

        // Duration overflow
        const overflows = slotEnd.getTime() > windowEndTime

        // Lead time check (2h from now)
        const isTooSoon = cursor < minBookableStart

        // End buffer check (1h before window end)
        const isTooLate = cursor > maxBookableStart

        // Conflicts check
        const hasConflict =
          !overflows &&
          (blockedTimes.some((b) => b.startDatetime < slotEnd && b.endDatetime > slotStart) ||
            existingBookings.some((b) => b.scheduledStart < slotEnd && b.scheduledEnd > slotStart))

        allSlots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          disabled: overflows || isTooSoon || isTooLate || hasConflict,
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
    return Array.from(uniqueSlots.values()).sort((a, b) => a.start.localeCompare(b.start))
  },

  async getBookableDates(
    cleanerId: string,
    durationHours: number,
    daysAhead: number,
  ): Promise<string[]> {
    if (daysAhead <= 0) return []

    // Start from today in Cyprus timezone
    const todayStr = todayInCyprus()
    const todayDate = new Date(todayStr + 'T00:00:00Z')

    // Build date strings for the range
    const dateStrings: string[] = []
    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(todayDate)
      d.setUTCDate(d.getUTCDate() + i)
      dateStrings.push(d.toISOString().slice(0, 10))
    }

    // Query range in UTC covering all Cyprus days
    const rangeStart = cyprusToUTC(dateStrings[0], 0, 0)
    const rangeEnd = cyprusToUTC(dateStrings[dateStrings.length - 1], 23, 59)
    rangeEnd.setUTCSeconds(59, 999)

    const [schedules, blockedTimes, existingBookings] = await Promise.all([
      availabilityRepo.getSchedule(cleanerId),
      availabilityRepo.getBlockedTimesInRange(cleanerId, rangeStart, rangeEnd),
      bookingRepo.findActiveForCleaner(cleanerId, rangeStart, rangeEnd),
    ])

    const durationMs = durationHours * 60 * 60 * 1000
    const now = Date.now()
    const minBookableStart = now + 2 * 60 * 60 * 1000
    const dates: string[] = []

    for (const dateStr of dateStrings) {
      const d = new Date(dateStr + 'T00:00:00Z')

      const daySchedules = schedules
        .filter((s) => s.dayOfWeek === isoWeekday(d) && s.isActive)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))

      if (daySchedules.length === 0) continue

      let hasBookableSlot = false
      for (const schedule of daySchedules) {
        const [startH, startM] = schedule.startTime.split(':').map(Number)
        const [endH, endM] = schedule.endTime.split(':').map(Number)

        // Schedule times are in Cyprus local time
        const windowStart = cyprusToUTC(dateStr, startH, startM)
        const windowEnd = cyprusToUTC(dateStr, endH, endM)

        const windowEndTime = windowEnd.getTime()
        const maxBookableStart = windowEndTime - 1 * 60 * 60 * 1000
        let cursor = windowStart.getTime()

        while (cursor + durationMs <= windowEndTime) {
          if (cursor < minBookableStart || cursor > maxBookableStart) {
            cursor += SLOT_INTERVAL_MS
            continue
          }

          const slotStart = new Date(cursor)
          const slotEnd = new Date(cursor + durationMs)
          const hasConflict =
            blockedTimes.some((b) => b.startDatetime < slotEnd && b.endDatetime > slotStart) ||
            existingBookings.some((b) => b.scheduledStart < slotEnd && b.scheduledEnd > slotStart)

          if (!hasConflict) {
            hasBookableSlot = true
            break
          }

          cursor += SLOT_INTERVAL_MS
        }

        if (hasBookableSlot) break
      }

      if (hasBookableSlot) {
        dates.push(dateStr)
      }
    }

    return dates
  },
}

function isoWeekday(date: Date): number {
  const d = date.getUTCDay() // 0=Sun...6=Sat
  return d === 0 ? 7 : d
}

