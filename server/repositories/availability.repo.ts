import { db } from '../db'

/** Convert "HH:MM" string to a Date with only the time portion set (UTC) */
function timeStringToDate(time: string): Date {
  const [h, m] = time.split(':').map(Number)
  return new Date(Date.UTC(1970, 0, 1, h, m, 0, 0))
}

/** Convert a Date (time-only, UTC) back to "HH:MM" string */
function dateToTimeString(d: Date): string {
  const h = d.getUTCHours().toString().padStart(2, '0')
  const m = d.getUTCMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

/** Normalise a schedule row from Prisma (DateTime time fields) to plain strings */
function normalizeSchedule(row: any) {
  return {
    ...row,
    startTime: row.startTime instanceof Date ? dateToTimeString(row.startTime) : row.startTime,
    endTime: row.endTime instanceof Date ? dateToTimeString(row.endTime) : row.endTime,
  }
}

export const availabilityRepo = {
  getSchedule: async (cleanerId: string) => {
    const rows = await db.availabilitySchedule.findMany({
      where: { cleanerId },
      orderBy: { dayOfWeek: 'asc' },
    })
    return rows.map(normalizeSchedule)
  },

  replaceSchedule: async (
    cleanerId: string,
    schedules: Array<{
      dayOfWeek: number
      startTime: string
      endTime: string
      bufferMinutes: number
      isActive: boolean
    }>
  ) => {
    await db.availabilitySchedule.deleteMany({ where: { cleanerId } })
    if (schedules.length === 0) return []

    for (const s of schedules) {
      await db.availabilitySchedule.create({
        data: {
          cleanerId,
          dayOfWeek: s.dayOfWeek,
          startTime: timeStringToDate(s.startTime),
          endTime: timeStringToDate(s.endTime),
          bufferMinutes: s.bufferMinutes,
          isActive: s.isActive,
        },
      })
    }

    const rows = await db.availabilitySchedule.findMany({
      where: { cleanerId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })
    return rows.map(normalizeSchedule)
  },

  getBlockedTimes: (cleanerId: string) =>
    db.blockedTime.findMany({
      where: { cleanerId },
      orderBy: { startDatetime: 'asc' },
    }),

  addBlockedTime: (cleanerId: string, data: { startDatetime: Date; endDatetime: Date; reason?: string }) =>
    db.blockedTime.create({ data: { cleanerId, ...data } }),

  deleteBlockedTime: (id: string, cleanerId: string) =>
    db.blockedTime.deleteMany({ where: { id, cleanerId } }),

  getBlockedTimesInRange: (cleanerId: string, start: Date, end: Date) =>
    db.blockedTime.findMany({
      where: {
        cleanerId,
        startDatetime: { lt: end },
        endDatetime: { gt: start },
      },
    }),
}
