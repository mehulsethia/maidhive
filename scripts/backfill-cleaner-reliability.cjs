const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')
const geocodeFuture = process.argv.includes('--geocode-future')
const DAY_MS = 24 * 60 * 60 * 1000

function cyprusDate(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Nicosia' }).format(date)
}

async function geocode(address) {
  const key = process.env.GOOGLE_GEOCODING_API_KEY
  if (!key) return { status: 'not_configured' }
  const params = new URLSearchParams({ address, key })
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`)
  if (!response.ok) return { status: `http_${response.status}` }
  const body = await response.json()
  const location = body.results?.[0]?.geometry?.location
  if (body.status !== 'OK' || !location) return { status: 'not_found' }
  return { status: 'verified', latitude: location.lat, longitude: location.lng }
}

async function backfillIncidents() {
  const bookings = await prisma.booking.findMany({
    where: {
      status: 'cancelled',
      acceptedAt: { not: null },
      cancelledAt: { not: null },
      cancelledBy: { not: null },
    },
    select: {
      id: true,
      cleanerId: true,
      scheduledStart: true,
      cancelledAt: true,
      cancelledBy: true,
      cleaner: { select: { userId: true } },
    },
    orderBy: { cancelledAt: 'asc' },
  })

  const groups = new Map()
  const windows = {
    more_than_24h: 0,
    between_12h_24h: 0,
    less_than_12h: 0,
  }
  for (const booking of bookings) {
    if (booking.cancelledBy !== booking.cleaner.userId || !booking.cancelledAt) continue
    const leadMs = booking.scheduledStart.getTime() - booking.cancelledAt.getTime()
    const hoursBeforeStart = leadMs / (60 * 60 * 1000)
    const cancellationWindow =
      hoursBeforeStart < 12
        ? 'less_than_12h'
        : hoursBeforeStart <= 24
          ? 'between_12h_24h'
          : 'more_than_24h'
    windows[cancellationWindow] += 1
    if (apply) {
      await prisma.cleanerCancellationEvent.upsert({
        where: { bookingId: booking.id },
        create: {
          cleanerId: booking.cleanerId,
          bookingId: booking.id,
          cancelledByUserId: booking.cancelledBy,
          cancellationWindow,
          acceptedBooking: true,
          isLastMinute: cancellationWindow === 'less_than_12h',
          scheduledStart: booking.scheduledStart,
          cancelledAt: booking.cancelledAt,
          hoursBeforeStart,
        },
        update: {
          cancelledByUserId: booking.cancelledBy,
          cancellationWindow,
          acceptedBooking: true,
          isLastMinute: cancellationWindow === 'less_than_12h',
          scheduledStart: booking.scheduledStart,
          cancelledAt: booking.cancelledAt,
          hoursBeforeStart,
        },
      })
    }
    if (cancellationWindow !== 'less_than_12h') continue
    const incidentDate = cyprusDate(booking.cancelledAt)
    const key = `${booking.cleanerId}|${incidentDate}`
    const group = groups.get(key) ?? {
      cleanerId: booking.cleanerId,
      incidentDate,
      occurredAt: booking.cancelledAt,
      latestAt: booking.cancelledAt,
      bookingIds: [],
    }
    group.bookingIds.push(booking.id)
    if (booking.cancelledAt < group.occurredAt) group.occurredAt = booking.cancelledAt
    if (booking.cancelledAt > group.latestAt) group.latestAt = booking.cancelledAt
    groups.set(key, group)
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    cancellation_events: windows,
    last_minute_incidents: groups.size,
  }, null, 2))
  if (!apply) return

  const byCleaner = new Map()
  for (const group of groups.values()) {
    const incident = await prisma.cleanerReliabilityIncident.upsert({
      where: {
        cleanerId_incidentType_sourceKey: {
          cleanerId: group.cleanerId,
          incidentType: 'last_minute_cancellation',
          sourceKey: group.incidentDate,
        },
      },
      create: {
        cleanerId: group.cleanerId,
        bookingId: group.bookingIds[0],
        bookingIds: group.bookingIds,
        incidentType: 'last_minute_cancellation',
        incidentDate: group.incidentDate,
        sourceKey: group.incidentDate,
        occurredAt: group.occurredAt,
        latestAt: group.latestAt,
        metadata: { backfilled: true },
      },
      update: {
        bookingIds: group.bookingIds,
        occurredAt: group.occurredAt,
        latestAt: group.latestAt,
        metadata: { backfilled: true },
      },
    })
    const incidents = byCleaner.get(group.cleanerId) ?? []
    incidents.push(incident)
    byCleaner.set(group.cleanerId, incidents)
    await prisma.cleanerCancellationEvent.updateMany({
      where: { bookingId: { in: group.bookingIds } },
      data: { incidentId: incident.id },
    })
  }

  for (const incidents of byCleaner.values()) {
    incidents.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
    for (let index = 1; index < incidents.length; index += 1) {
      const current = incidents[index]
      const hasPriorInWindow = incidents
        .slice(0, index)
        .some((prior) => current.occurredAt.getTime() - prior.occurredAt.getTime() <= 30 * DAY_MS)
      if (!hasPriorInWindow) continue
      await prisma.cleanerStrike.upsert({
        where: { incidentId: current.id },
        create: {
          cleanerId: current.cleanerId,
          bookingId: current.bookingId,
          incidentId: current.id,
          strikeType: 'reliability_last_minute_cancellation',
          reason: 'Backfilled repeated last-minute cancellation incident within 30 days',
          expiresAt: new Date(current.occurredAt.getTime() + 90 * DAY_MS),
        },
        update: {},
      })
    }
  }
}

async function backfillCoordinates() {
  if (!geocodeFuture) return
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ['accepted', 'confirmed'] },
      scheduledStart: { gt: new Date() },
      serviceLatitude: null,
    },
    select: {
      id: true,
      address: true,
      city: true,
      postcode: true,
      country: true,
    },
  })
  console.log(JSON.stringify({ future_bookings_to_geocode: bookings.length }, null, 2))
  if (!apply) return
  for (const booking of bookings) {
    const result = await geocode(
      [booking.address, booking.city, booking.postcode, booking.country].join(', '),
    )
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        serviceLatitude: result.latitude,
        serviceLongitude: result.longitude,
        geocodingProvider: 'google',
        geocodingStatus: result.status,
        geocodedAt: result.status === 'verified' ? new Date() : null,
      },
    })
  }
}

async function main() {
  await backfillIncidents()
  await backfillCoordinates()
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
