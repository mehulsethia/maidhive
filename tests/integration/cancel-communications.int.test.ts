import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const seeded = vi.hoisted(() => ({
  clientUser: {
    id: '11111111-1111-1111-1111-111111111111',
    role: 'client',
    email: 'client@test.local',
    name: 'Client User',
  },
  cleanerUser: {
    id: '22222222-2222-2222-2222-222222222222',
    role: 'cleaner',
    email: 'cleaner@test.local',
    name: 'Cleaner User',
  },
}))

const state = vi.hoisted(() => ({
  booking: null as any,
  bookingsById: {} as Record<string, any>,
  remainingToday: [] as any[],
  notifications: [] as any[],
  cleanerCancelledByClientEmails: 0,
  cleanerCancelledByClientPayloads: [] as any[],
  clientCancellationEmails: 0,
  clientCancellationPayloads: [] as any[],
  clientCancelledByCleanerEmails: 0,
  clientRejectedEmails: 0,
  amendmentDeclinedPayloads: [] as any[],
  actionEvents: [] as any[],
  paymentUpdates: [] as any[],
  removeCalendarCalls: 0,
  blockedTimes: [] as any[],
}))

vi.mock('@/server/repositories/booking.repo', () => ({
  bookingRepo: {
    findById: vi.fn(async (id: string) => state.bookingsById[id] ?? state.booking),
    update: vi.fn(async (id: string, patch: any) => {
      const base = state.bookingsById[id] ?? state.booking
      const updated = { ...base, ...patch }
      state.bookingsById[id] = updated
      if (state.booking?.id === id) state.booking = updated
      return updated
    }),
    updateWithActionEvent: vi.fn(async (_id: string, patch: any, event: any) => {
      state.actionEvents.push(event)
      return { ...state.booking, ...patch }
    }),
    findRemainingTodayForCleaner: vi.fn(async () => state.remainingToday),
    findActiveForCleaner: vi.fn(async () => []),
  },
}))

vi.mock('@/server/repositories/client.repo', () => ({
  clientRepo: {
    findByUserId: vi.fn(async (userId: string) =>
      userId === seeded.clientUser.id ? { id: 'client_profile_1', userId } : null),
  },
}))

vi.mock('@/server/repositories/cleaner.repo', () => ({
  cleanerRepo: {
    findByUserId: vi.fn(async (userId: string) =>
      userId === seeded.cleanerUser.id ? { id: 'cleaner_profile_1', userId } : null),
  },
}))

vi.mock('@/server/repositories/availability.repo', () => ({
  availabilityRepo: {
    getSchedule: vi.fn(async () => [
      { dayOfWeek: 6, isActive: true, startTime: '00:00', endTime: '23:59' },
    ]),
    getBlockedTimesInRange: vi.fn(async () => []),
    addBlockedTime: vi.fn(async (_cleanerId: string, data: any) => {
      state.blockedTimes.push(data)
      return { id: `blocked_${state.blockedTimes.length}`, ...data }
    }),
  },
}))

vi.mock('@/server/repositories/payment.repo', () => ({
  paymentRepo: {
    update: vi.fn(async (_id: string, patch: any) => {
      state.paymentUpdates.push(patch)
      return true
    }),
  },
}))

vi.mock('@/server/repositories/dispute.repo', () => ({
  disputeRepo: {
    findByBookingId: vi.fn(async () => null),
  },
}))

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      updateMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    cleanerStrike: {
      create: vi.fn(async () => ({})),
    },
    payment: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    bookingActionEvent: {
      create: vi.fn(async ({ data }: any) => {
        state.actionEvents.push(data)
        return { id: `event_${state.actionEvents.length}`, ...data }
      }),
    },
  },
}))

vi.mock('@/server/services/loops-email.service', () => ({
  loopsEmailService: {
    sendClientSelfCancellationConfirmation: vi.fn(async (payload: any) => {
      state.clientCancellationEmails += 1
      state.clientCancellationPayloads.push(payload)
      return true
    }),
    sendClientBookingCancelledByCleaner: vi.fn(async () => {
      state.clientCancelledByCleanerEmails += 1
      return true
    }),
    sendCleanerBookingCancelledByClient: vi.fn(async (payload: any) => {
      state.cleanerCancelledByClientEmails += 1
      state.cleanerCancelledByClientPayloads.push(payload)
      return true
    }),
    sendCleanerCancellationWarningOrStrike: vi.fn(async () => true),
    sendClientBookingRejectedOrExpired: vi.fn(async () => {
      state.clientRejectedEmails += 1
      return true
    }),
    sendAmendmentRequestDeclined: vi.fn(async (payload: any) => {
      state.amendmentDeclinedPayloads.push(payload)
      return true
    }),
    sendClientAlternateTimeProposed: vi.fn(async () => true),
    sendCleanerClientAlternateTimeProposed: vi.fn(async () => true),
    sendAmendmentRequestAccepted: vi.fn(async () => true),
  },
}))

vi.mock('@/server/services/in-app-notification.service', () => ({
  pushInAppNotification: vi.fn(async (payload: any) => {
    state.notifications.push(payload)
    return true
  }),
}))

vi.mock('@/server/services/google-calendar.service', () => ({
  googleCalendarService: {
    upsertCleanerBookingEvent: vi.fn(async () => true),
    removeCleanerBookingEvent: vi.fn(async () => {
      state.removeCalendarCalls += 1
      return true
    }),
  },
}))

vi.mock('@/server/stripe', () => ({
  stripe: {
    paymentIntents: {
      cancel: vi.fn(async () => ({ id: 'pi_cancelled' })),
      capture: vi.fn(async () => ({ latest_charge: 'ch_1' })),
    },
  },
}))

describe('Booking cancellation communications', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.resetModules()
    state.notifications = []
    state.bookingsById = {}
    state.remainingToday = []
    state.cleanerCancelledByClientEmails = 0
    state.cleanerCancelledByClientPayloads = []
    state.clientCancellationEmails = 0
    state.clientCancellationPayloads = []
    state.clientCancelledByCleanerEmails = 0
    state.clientRejectedEmails = 0
    state.amendmentDeclinedPayloads = []
    state.actionEvents = []
    state.paymentUpdates = []
    state.removeCalendarCalls = 0
    state.blockedTimes = []
  })

  it('uses request-cancel wording for pending request cancellations before confirmation', async () => {
    state.booking = {
      id: 'booking_pending_1',
      status: 'pending',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      scheduledStart: new Date('2026-06-20T10:00:00.000Z'),
      durationHours: 2,
      payment: { status: 'authorized', stripePaymentIntentId: null },
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: { userId: seeded.cleanerUser.id, user: { email: seeded.cleanerUser.email, name: seeded.cleanerUser.name } },
    }

    const { bookingService } = await import('@/server/services/booking.service')
    await bookingService.cancel(state.booking.id, seeded.clientUser as any, 'Cancelled before acceptance')

    expect(state.notifications).toHaveLength(1)
    expect(state.notifications[0].userId).toBe(seeded.cleanerUser.id)
    expect(state.notifications[0].title).toBe('Client cancelled booking request')
    expect(String(state.notifications[0].body)).toContain('before confirmation')
    expect(state.cleanerCancelledByClientEmails).toBe(0)
    expect(state.clientCancellationEmails).toBe(0)
  })

  it('skips cancellation notifications/emails for draft-like pending bookings without authorization', async () => {
    state.booking = {
      id: 'booking_draft_like_1',
      status: 'pending',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      scheduledStart: new Date('2026-06-20T10:00:00.000Z'),
      durationHours: 2,
      payment: { status: 'requires_payment_method', stripePaymentIntentId: null },
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: { userId: seeded.cleanerUser.id, user: { email: seeded.cleanerUser.email, name: seeded.cleanerUser.name } },
    }

    const { bookingService } = await import('@/server/services/booking.service')
    const updated = await bookingService.cancel(state.booking.id, seeded.clientUser as any, 'Cancelled draft session')

    expect(updated.status).toBe('cancelled')
    expect(state.notifications).toHaveLength(0)
    expect(state.cleanerCancelledByClientEmails).toBe(0)
    expect(state.clientCancellationEmails).toBe(0)
    expect(state.removeCalendarCalls).toBe(0)
  })

  it('uses confirmed-cancel wording and sends cleaner email + client in-app notification', async () => {
    state.booking = {
      id: 'booking_confirmed_1',
      status: 'confirmed',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      acceptedAt: new Date('2026-06-18T09:00:00.000Z'),
      confirmedAt: new Date('2026-06-18T09:05:00.000Z'),
      scheduledStart: new Date('2026-06-20T10:00:00.000Z'),
      durationHours: 2,
      payment: null,
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: { userId: seeded.cleanerUser.id, user: { email: seeded.cleanerUser.email, name: seeded.cleanerUser.name } },
    }

    const { bookingService } = await import('@/server/services/booking.service')
    await bookingService.cancel(state.booking.id, seeded.clientUser as any, 'Confirmed cancellation')

    expect(state.notifications).toHaveLength(2)

    const cleanerNotif = state.notifications.find((item) => item.userId === seeded.cleanerUser.id)
    const clientNotif = state.notifications.find((item) => item.userId === seeded.clientUser.id)

    expect(cleanerNotif?.title).toBe('Client cancelled booking')
    expect(String(cleanerNotif?.body ?? '')).toContain('confirmed booking scheduled for')
    expect(clientNotif?.title).toBe('Booking cancelled')
    expect(String(clientNotif?.body ?? '')).toContain('has been cancelled')

    expect(state.cleanerCancelledByClientEmails).toBe(1)
    expect(state.cleanerCancelledByClientPayloads[0]).toMatchObject({
      email: seeded.cleanerUser.email,
      bookingId: 'booking_confirmed_1',
      cancellationReason: 'Confirmed cancellation',
    })
    expect(state.clientCancellationEmails).toBe(1)
    expect(state.removeCalendarCalls).toBe(1)
  })

  it('releases authorization and creates a permanent cleaner notification when the cleaner cancels', async () => {
    state.booking = {
      id: 'booking_cleaner_cancelled_1',
      status: 'confirmed',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      acceptedAt: new Date('2099-06-18T09:00:00.000Z'),
      confirmedAt: new Date('2099-06-18T09:05:00.000Z'),
      scheduledStart: new Date('2099-06-20T10:00:00.000Z'),
      durationHours: 2,
      totalAmount: 33,
      cleanerPayout: 30,
      platformFee: 3,
      payment: { id: 'payment_1', status: 'authorized', amount: 33, stripePaymentIntentId: 'pi_1' },
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: { userId: seeded.cleanerUser.id, user: { email: seeded.cleanerUser.email, name: seeded.cleanerUser.name } },
    }

    const { bookingService } = await import('@/server/services/booking.service')
    await bookingService.cancel(
      state.booking.id,
      seeded.cleanerUser as any,
      'Cancelled by cleaner more than 24 hours before scheduled start',
    )

    expect(state.paymentUpdates).toContainEqual(expect.objectContaining({
      status: 'released',
      failedAt: null,
      refundReason: 'payment_authorisation_released',
      cleanerPayout: 0,
      platformFee: 0,
      payoutScheduledAt: null,
    }))
    expect(state.notifications).toContainEqual(expect.objectContaining({
      userId: seeded.cleanerUser.id,
      title: 'You cancelled your booking',
      body: 'You cancelled the booking for 20 Jun 2099 at 13:00. Your final payout is €0.00 and the cancellation has been recorded in your reliability history.',
      data: { booking_id: state.booking.id },
    }))
    expect(state.notifications).toContainEqual(expect.objectContaining({
      userId: seeded.clientUser.id,
      title: 'Cleaner cancelled your booking',
      body: 'Your cleaner cancelled the booking for 20 Jun 2099 at 13:00. No cancellation charge applies. Your €33.00 payment authorisation has been released.',
      data: { booking_id: state.booking.id },
    }))
    expect(state.actionEvents).toContainEqual(expect.objectContaining({
      bookingId: state.booking.id,
      type: 'payment_authorisation_released',
      actorRole: 'cleaner',
      metadata: expect.objectContaining({
        amount: 33,
        payment_state_before: 'authorized',
        payment_state_after: 'released',
        reason: 'cleaner_cancelled_before_capture',
      }),
    }))
    expect(state.clientCancelledByCleanerEmails).toBe(1)
  })

  it('cancels remaining same-day bookings when cleaner marks rest of today unavailable', async () => {
    const primary = {
      id: 'booking_rest_today_primary',
      status: 'confirmed',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      acceptedAt: new Date('2099-07-03T07:00:00.000Z'),
      confirmedAt: new Date('2099-07-03T07:05:00.000Z'),
      scheduledStart: new Date(),
      scheduledEnd: new Date(Date.now() + 60 * 60 * 1000),
      durationHours: 1,
      payment: { id: 'payment_primary', status: 'authorized', stripePaymentIntentId: null },
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: { userId: seeded.cleanerUser.id, user: { email: seeded.cleanerUser.email, name: seeded.cleanerUser.name } },
    }
    const secondary = {
      ...primary,
      id: 'booking_rest_today_secondary',
      payment: { id: 'payment_secondary', status: 'authorized', stripePaymentIntentId: null },
      scheduledStart: new Date(Date.now() + 2 * 60 * 60 * 1000),
      scheduledEnd: new Date(Date.now() + 3 * 60 * 60 * 1000),
    }
    state.booking = primary
    state.bookingsById = {
      [primary.id]: primary,
      [secondary.id]: secondary,
    }
    state.remainingToday = [{ id: secondary.id, scheduledStart: secondary.scheduledStart }]

    const { bookingService } = await import('@/server/services/booking.service')
    const updated = await bookingService.cancel(
      primary.id,
      seeded.cleanerUser as any,
      'Cancelled by cleaner under 12 hours before scheduled start',
      { cancelRestOfToday: true },
    )

    expect(updated.status).toBe('cancelled')
    expect((updated as any).rest_of_today_cancelled_count).toBe(1)
    expect(state.bookingsById[secondary.id].status).toBe('cancelled')
    expect(state.bookingsById[secondary.id].cancellationReason).toBe('Cancelled by cleaner: unavailable for the rest of today')
    expect(state.blockedTimes).toHaveLength(1)
    expect(state.clientCancelledByCleanerEmails).toBe(2)
  })

  it('tells the client that their early cancellation has no charge', async () => {
    state.booking = {
      id: 'booking_client_early_cancel_1',
      status: 'confirmed',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      acceptedAt: new Date('2099-06-18T09:00:00.000Z'),
      confirmedAt: new Date('2099-06-18T09:05:00.000Z'),
      scheduledStart: new Date('2099-07-03T07:00:00.000Z'),
      durationHours: 2,
      totalAmount: 35.2,
      subtotal: 32,
      platformFee: 3.2,
      payment: { id: 'payment_early_1', status: 'authorized', stripePaymentIntentId: 'pi_early_1' },
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: { userId: seeded.cleanerUser.id, user: { email: seeded.cleanerUser.email, name: seeded.cleanerUser.name } },
    }

    const { bookingService } = await import('@/server/services/booking.service')
    await bookingService.cancel(
      state.booking.id,
      seeded.clientUser as any,
      'Cancelled by client more than 24 hours before scheduled start',
    )

    expect(state.paymentUpdates).toContainEqual(expect.objectContaining({
      status: 'released',
      failedAt: null,
    }))
    expect(state.notifications).toContainEqual(expect.objectContaining({
      userId: seeded.clientUser.id,
      title: 'Booking cancelled',
      body: 'You cancelled your booking for 3 Jul 2099 at 10:00. No cancellation charge applies. You have not been charged. Temporary payment hold released: €35.20.',
    }))
    expect(state.clientCancellationPayloads).toContainEqual(expect.objectContaining({
      cancellationWindowMessage: 'You cancelled more than 24 hours before the scheduled start.',
      cancellationChargeMessage: 'No cancellation charge applies.',
      refundOrReleaseMessage: 'You have not been charged. Temporary payment hold released: €35.20.',
    }))
  })

  it.each([
    {
      hoursUntilStart: 18,
      cancellationWindowMessage: 'You cancelled between 12 and 24 hours before the scheduled start.',
      cancellationChargeMessage: 'Cancellation charge: €5.00.',
      refundOrReleaseMessage: 'Refund issued: €30.20.',
    },
    {
      hoursUntilStart: 6,
      cancellationWindowMessage: 'You cancelled less than 12 hours before the scheduled start.',
      cancellationChargeMessage: 'Cancellation charge: €17.60.',
      refundOrReleaseMessage: 'Refund issued: €17.60.',
    },
  ])(
    'sends the client self-cancellation email $hoursUntilStart hours before start',
    async ({
      hoursUntilStart,
      cancellationWindowMessage,
      cancellationChargeMessage,
      refundOrReleaseMessage,
    }) => {
      state.booking = {
        id: `booking_client_cancel_${hoursUntilStart}h`,
        status: 'confirmed',
        clientId: 'client_profile_1',
        cleanerId: 'cleaner_profile_1',
        scheduledStart: new Date(Date.now() + hoursUntilStart * 60 * 60 * 1000),
        durationHours: 2,
        totalAmount: 35.2,
        subtotal: 32,
        platformFee: 3.2,
        payment: {
          id: `payment_client_cancel_${hoursUntilStart}h`,
          status: 'authorized',
          stripePaymentIntentId: `pi_client_cancel_${hoursUntilStart}h`,
        },
        client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
        cleaner: { userId: seeded.cleanerUser.id, user: { email: seeded.cleanerUser.email, name: seeded.cleanerUser.name } },
      }

      const { bookingService } = await import('@/server/services/booking.service')
      await bookingService.cancel(
        state.booking.id,
        seeded.clientUser as any,
        `Cancelled by client ${hoursUntilStart} hours before scheduled start`,
      )

      expect(state.clientCancellationEmails).toBe(1)
      expect(state.clientCancellationPayloads[0]).toMatchObject({
        email: seeded.clientUser.email,
        clientName: seeded.clientUser.name,
        cleanerName: seeded.cleanerUser.name,
        bookingDate: state.booking.scheduledStart,
        cancellationWindowMessage,
        cancellationChargeMessage,
        refundOrReleaseMessage,
      })
      expect(state.clientCancelledByCleanerEmails).toBe(0)
    },
  )

  it('sends cleaner cancellation email for accepted-but-not-confirmed client cancellation', async () => {
    state.booking = {
      id: 'booking_accepted_1',
      status: 'accepted',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      acceptedAt: new Date('2026-06-18T09:00:00.000Z'),
      confirmedAt: null,
      scheduledStart: new Date('2026-06-20T10:00:00.000Z'),
      durationHours: 2,
      payment: { status: 'authorized', stripePaymentIntentId: null },
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: { userId: seeded.cleanerUser.id, user: { email: seeded.cleanerUser.email, name: seeded.cleanerUser.name } },
    }

    const { bookingService } = await import('@/server/services/booking.service')
    await bookingService.cancel(state.booking.id, seeded.clientUser as any, 'Accepted cancellation')

    expect(state.cleanerCancelledByClientEmails).toBe(1)
    expect(state.cleanerCancelledByClientPayloads[0]).toMatchObject({
      email: seeded.cleanerUser.email,
      bookingId: 'booking_accepted_1',
      cancellationReason: 'Accepted cancellation',
    })
    expect(state.clientCancellationEmails).toBe(0)
  })

  it('cancels confirmed booking even when cleaner relation data is incomplete', async () => {
    state.booking = {
      id: 'booking_confirmed_legacy_relation',
      status: 'confirmed',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      acceptedAt: new Date('2026-06-18T09:00:00.000Z'),
      confirmedAt: new Date('2026-06-18T09:05:00.000Z'),
      scheduledStart: new Date('2026-06-20T10:00:00.000Z'),
      durationHours: 2,
      payment: null,
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: null,
    }

    const { bookingService } = await import('@/server/services/booking.service')
    const updated = await bookingService.cancel(state.booking.id, seeded.clientUser as any, 'Confirmed cancellation')

    expect(updated.status).toBe('cancelled')
    expect(state.notifications).toHaveLength(1)
    expect(state.notifications[0].userId).toBe(seeded.clientUser.id)
    expect(state.notifications[0].title).toBe('Booking cancelled')
    expect(state.cleanerCancelledByClientEmails).toBe(0)
    expect(state.clientCancellationEmails).toBe(1)
  })

  it('sends amendment declined email to client when cleaner declines client amendment request', async () => {
    state.booking = {
      id: 'booking_client_amend_1',
      status: 'confirmed',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      scheduledStart: new Date('2026-06-20T10:00:00.000Z'),
      scheduledEnd: new Date('2026-06-20T12:00:00.000Z'),
      proposedStart: new Date('2026-06-20T11:00:00.000Z'),
      proposedEnd: new Date('2026-06-20T13:00:00.000Z'),
      proposalBy: 'client',
      proposalContext: 'amend_start',
      payment: null,
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: { userId: seeded.cleanerUser.id, user: { email: seeded.cleanerUser.email, name: seeded.cleanerUser.name } },
    }

    const { bookingService } = await import('@/server/services/booking.service')
    await bookingService.applyAction(state.booking.id, seeded.cleanerUser as any, { action: 'decline_proposal' })

    expect(state.clientRejectedEmails).toBe(0)
    expect(state.amendmentDeclinedPayloads).toEqual([
      expect.objectContaining({
        email: seeded.clientUser.email,
        fullName: seeded.clientUser.name,
        originalStart: state.booking.scheduledStart,
      }),
    ])
    expect(state.actionEvents).toContainEqual(expect.objectContaining({
      type: 'amend_start_declined',
      actorRole: 'cleaner',
      metadata: expect.objectContaining({
        original_time_unchanged: true,
        proposed_by: 'client',
      }),
    }))
  })

  it('sends amendment declined email to cleaner when client declines cleaner amendment request', async () => {
    state.booking = {
      id: 'booking_cleaner_amend_1',
      status: 'confirmed',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      scheduledStart: new Date('2026-06-20T10:00:00.000Z'),
      scheduledEnd: new Date('2026-06-20T12:00:00.000Z'),
      proposedStart: new Date('2026-06-20T11:00:00.000Z'),
      proposedEnd: new Date('2026-06-20T13:00:00.000Z'),
      proposalBy: 'cleaner',
      proposalContext: 'amend_start',
      payment: null,
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: { userId: seeded.cleanerUser.id, user: { email: seeded.cleanerUser.email, name: seeded.cleanerUser.name } },
    }

    const { bookingService } = await import('@/server/services/booking.service')
    await bookingService.applyAction(state.booking.id, seeded.clientUser as any, { action: 'decline_proposal' })

    expect(state.clientRejectedEmails).toBe(0)
    expect(state.amendmentDeclinedPayloads).toEqual([
      expect.objectContaining({
        email: seeded.cleanerUser.email,
        fullName: seeded.cleanerUser.name,
        originalStart: state.booking.scheduledStart,
      }),
    ])
    expect(state.actionEvents).toContainEqual(expect.objectContaining({
      type: 'amend_start_declined',
      actorRole: 'client',
      metadata: expect.objectContaining({
        original_time_unchanged: true,
        proposed_by: 'cleaner',
      }),
    }))
  })

  it('caps Amend Start Time expiry at the proposed amended start time', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-20T15:20:00.000Z'))
    state.booking = {
      id: 'booking_amend_short_window',
      status: 'confirmed',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      scheduledStart: new Date('2026-06-20T17:30:00.000Z'),
      scheduledEnd: new Date('2026-06-20T18:30:00.000Z'),
      durationHours: 1,
      cleanerProposals: 0,
      clientProposals: 0,
      postCleanerProposals: 0,
      postClientProposals: 0,
      proposalBy: null,
      proposalContext: null,
      payment: null,
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: { userId: seeded.cleanerUser.id, user: { email: seeded.cleanerUser.email, name: seeded.cleanerUser.name } },
    }

    const { bookingService } = await import('@/server/services/booking.service')
    const updated = await bookingService.applyAction(state.booking.id, seeded.cleanerUser as any, {
      action: 'amend_start_time',
      proposed_start: '2026-06-20T15:30:00.000Z',
    })

    expect(updated.proposalContext).toBe('amend_start')
    expect(updated.proposalExpiresAt?.toISOString()).toBe('2026-06-20T15:30:00.000Z')
    expect(state.notifications.at(-1)).toMatchObject({
      title: 'Start time amendment requested',
    })
    expect(String(state.notifications.at(-1)?.body)).toContain('Respond before')
  })

  it('rejects accepting an Amend Start Time request after proposed start has passed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-20T15:31:00.000Z'))
    state.booking = {
      id: 'booking_amend_expired_at_start',
      status: 'confirmed',
      clientId: 'client_profile_1',
      cleanerId: 'cleaner_profile_1',
      scheduledStart: new Date('2026-06-20T17:30:00.000Z'),
      scheduledEnd: new Date('2026-06-20T18:30:00.000Z'),
      proposedStart: new Date('2026-06-20T15:30:00.000Z'),
      proposedEnd: new Date('2026-06-20T16:30:00.000Z'),
      proposalBy: 'cleaner',
      proposalContext: 'amend_start',
      proposalExpiresAt: new Date('2026-06-20T16:20:00.000Z'),
      cleanerProposals: 1,
      clientProposals: 0,
      payment: null,
      client: { userId: seeded.clientUser.id, user: { email: seeded.clientUser.email, name: seeded.clientUser.name } },
      cleaner: { userId: seeded.cleanerUser.id, user: { email: seeded.cleanerUser.email, name: seeded.cleanerUser.name } },
    }

    const { bookingService } = await import('@/server/services/booking.service')

    await expect(bookingService.applyAction(state.booking.id, seeded.clientUser as any, {
      action: 'accept_proposal',
    })).rejects.toMatchObject({
      message: 'Amend Start Time request expired. The original booking time remains in effect.',
      status: 400,
    })
    expect(state.actionEvents).not.toContainEqual(expect.objectContaining({
      type: 'amend_start_accepted',
    }))
  })
})
