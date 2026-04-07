import { db } from '../db'

export const availabilityRepo = {
  getSchedule: (cleanerId: string) =>
    db.availabilitySchedule.findMany({
      where: { cleanerId },
      orderBy: { dayOfWeek: 'asc' },
    }),

  upsertSchedule: (
    cleanerId: string,
    schedules: Array<{
      dayOfWeek: number
      startTime: string
      endTime: string
      bufferMinutes: number
      isActive: boolean
    }>
  ) =>
    Promise.all(
      schedules.map((s) =>
        db.availabilitySchedule.upsert({
          where: { cleanerId_dayOfWeek: { cleanerId, dayOfWeek: s.dayOfWeek } },
          update: {
            startTime: s.startTime,
            endTime: s.endTime,
            bufferMinutes: s.bufferMinutes,
            isActive: s.isActive,
          },
          create: { cleanerId, ...s },
        })
      )
    ),

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
