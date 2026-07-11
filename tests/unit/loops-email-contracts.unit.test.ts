import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/server/repositories/cleaner.repo', () => ({
  cleanerRepo: {
    findById: vi.fn(async () => ({
      transportMode: 'requires_pickup',
      transportPickupLocation: 'Finikoudes bus stop',
      cleaningSupplies: 'own_supplies',
    })),
  },
}))

async function loadLoopsEmailService() {
  vi.resetModules()
  vi.stubEnv('LOOPS_API_KEY', 'test-loops-key')
  vi.stubEnv('LOOPS_TRANSACTIONAL_ENDPOINT', 'https://loops.test/transactional')
  vi.stubEnv('LOOPS_ADMIN_EMAIL', 'ops@maidhive.test')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.maidhive.test')
  vi.stubEnv('LOOPS_CLIENT_BOOKING_STARTED_TRANSACTIONAL_ID', 'client-booking-started-id')
  vi.stubEnv('LOOPS_CLIENT_BOOKING_COMPLETED_TRANSACTIONAL_ID', 'client-booking-completed-id')
  const fetchMock = vi.fn(async () => new Response('', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)

  const { loopsEmailService } = await import('@/server/services/loops-email.service')
  return { loopsEmailService, fetchMock }
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, index = -1) {
  const request = index < 0 ? fetchMock.mock.calls.at(index) : fetchMock.mock.calls[index]
  expect(request).toBeTruthy()
  const init = request?.[1] as RequestInit
  return JSON.parse(String(init.body))
}

describe('Loops email contracts', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('keeps every Loops send method in the reviewed contract surface', async () => {
    const { loopsEmailService } = await loadLoopsEmailService()

    expect(Object.keys(loopsEmailService).sort()).toEqual([
      'sendAdminDisputeRaised',
      'sendAdminNewCleanerApplication',
      'sendAmendmentRequestAccepted',
      'sendAmendmentRequestDeclined',
      'sendAmendmentRequestExpired',
      'sendCleanerApplicationApproved',
      'sendCleanerApplicationRejected',
      'sendCleanerBookingAcceptedConfirmation',
      'sendCleanerBookingCancelledByClient',
      'sendCleanerCancellationWarningOrStrike',
      'sendCleanerClientAlternateTimeProposed',
      'sendCleanerClientDeclinedProposal',
      'sendCleanerNewBookingRequest',
      'sendCleanerPayoutNotification',
      'sendCleanerSignup',
      'sendClientAccountCreated',
      'sendClientAlternateTimeProposed',
      'sendClientBookingCompleted',
      'sendClientBookingCancelledByCleaner',
      'sendClientBookingConfirmed',
      'sendClientBookingCreatedPending',
      'sendClientBookingRejectedOrExpired',
      'sendClientBookingStarted',
      'sendClientSelfCancellationConfirmation',
      'sendClientPaymentReceipt',
      'sendClientProposalDeclinedClosed',
      'sendClientReviewRequest',
      'sendDisputeRaisedAgainstNotification',
      'sendDisputeResolvedOutcome',
      'sendDisputeSubmittedConfirmation',
    ].sort())
  })

  it('sends admin/account lifecycle templates with exact IDs and links', async () => {
    const { loopsEmailService, fetchMock } = await loadLoopsEmailService()

    await loopsEmailService.sendAdminNewCleanerApplication({
      cleanerName: 'Cleaner User',
      cleanerEmail: 'cleaner@example.test',
    })
    await loopsEmailService.sendAdminDisputeRaised({
      bookingId: 'booking_123',
      clientName: 'Client User',
      cleanerName: 'Cleaner User',
      date: '2026-06-12T10:30:00.000Z',
    })
    await loopsEmailService.sendClientAccountCreated({
      email: 'client@example.test',
      fullName: 'Client User',
    })
    await loopsEmailService.sendCleanerSignup({
      email: 'cleaner@example.test',
      fullName: 'Cleaner User',
    })

    expect(requestBody(fetchMock, 0)).toEqual({
      transactionalId: 'cmo5hnj710d3y0jzuabzw6i6x',
      email: 'ops@maidhive.test',
      dataVariables: {
        cleaner_name: 'Cleaner User',
        cleaner_email: 'cleaner@example.test',
        admin_link: 'https://app.maidhive.test/admin/cleaners',
      },
    })
    expect(requestBody(fetchMock, 1)).toEqual({
      transactionalId: 'cmo5hoydy048w0i0p3io44dlm',
      email: 'ops@maidhive.test',
      dataVariables: {
        booking_id: 'booking_123',
        client_name: 'Client User',
        cleaner_name: 'Cleaner User',
        date: '2026-06-12T10:30:00.000Z',
        admin_link: 'https://app.maidhive.test/admin/disputes',
      },
    })
    expect(requestBody(fetchMock, 2)).toEqual({
      transactionalId: 'cmo2r81uz0ec30iyxo9lozvlg',
      email: 'client@example.test',
      dataVariables: {
        first_name: 'Client',
        all_cleaners_link: 'https://app.maidhive.test/client/cleaners',
      },
    })
    expect(requestBody(fetchMock, 3)).toEqual({
      transactionalId: 'cmo5hbjfv0lbm0iya3k626pjl',
      email: 'cleaner@example.test',
      dataVariables: {
        first_name: 'Cleaner',
        cta_link: 'https://app.maidhive.test/cleaner/onboarding',
      },
    })
  })

  it('sends client booking lifecycle templates with exact IDs and variables', async () => {
    const { loopsEmailService, fetchMock } = await loadLoopsEmailService()
    const scheduledStart = new Date('2026-06-12T10:30:00.000Z')

    await loopsEmailService.sendClientBookingConfirmed({
      email: 'client@example.test',
      fullName: 'Client User',
      cleanerId: 'cleaner_1',
      cleanerName: 'Cleaner User',
      scheduledStart,
      durationHours: 2,
      bookingId: 'booking_1',
      transportMode: 'requires_pickup',
      transportPickupLocation: 'Finikoudes bus stop',
      cleaningSupplies: 'own_supplies',
    })
    await loopsEmailService.sendClientBookingStarted({
      email: 'client@example.test',
      fullName: 'Client User',
      cleanerName: 'Cleaner User',
      scheduledStart,
      durationHours: 1,
      bookingId: 'booking_2',
    })
    await loopsEmailService.sendClientBookingCreatedPending({
      email: 'client@example.test',
      fullName: 'Client User',
      cleanerName: 'Cleaner User',
    })
    await loopsEmailService.sendClientBookingRejectedOrExpired({
      email: 'client@example.test',
      fullName: 'Client User',
      cleanerName: 'Cleaner User',
    })
    await loopsEmailService.sendClientPaymentReceipt({
      email: 'client@example.test',
      fullName: 'Client User',
      amount: 35.2,
      cleanerName: 'Cleaner User',
      date: scheduledStart,
    })
    await loopsEmailService.sendClientReviewRequest({
      email: 'client@example.test',
      fullName: 'Client User',
      cleanerName: 'Cleaner User',
      bookingId: 'booking_3',
    })
    await loopsEmailService.sendClientBookingCompleted({
      email: 'client@example.test',
      fullName: 'Client User',
      cleanerName: 'Cleaner User',
      bookingId: 'booking_4',
      completedBy: 'system',
    })
    await loopsEmailService.sendClientBookingCancelledByCleaner({
      email: 'client@example.test',
      fullName: 'Client User',
      date: scheduledStart,
      bookingId: 'booking_5',
    })
    await loopsEmailService.sendClientSelfCancellationConfirmation({
      email: 'client@example.test',
      clientName: 'Client User',
      cleanerName: 'Cleaner User',
      bookingDate: scheduledStart,
      cancellationWindowMessage: 'You cancelled between 12 and 24 hours before the scheduled start.',
      cancellationChargeMessage: 'Cancellation charge: €5.00.',
      refundOrReleaseMessage: '€30.20 will be refunded or released.',
    })

    expect(requestBody(fetchMock, 0)).toEqual({
      transactionalId: 'cmo2rcbtv2p880izkqlj9rxj9',
      email: 'client@example.test',
      dataVariables: {
        first_name: 'Client',
        cleaner_name: 'Cleaner User',
        booking_date: '12 Jun 2026',
        booking_time: '13:30',
        booking_duration: '2 hours',
        transport_note: 'Cleaner User requires a pickup and drop-off. Please arrange transport to: Finikoudes bus stop',
        supplies_note: 'Cleaner User will bring their own supplies.',
        booking_link: 'https://app.maidhive.test/client/bookings/booking_1',
      },
    })
    expect(requestBody(fetchMock, 1).transactionalId).toBe('client-booking-started-id')
    expect(requestBody(fetchMock, 1).dataVariables).toEqual({
      first_name: 'Client',
      cleaner_name: 'Cleaner User',
      booking_date: '12 Jun 2026',
      booking_time: '13:30',
      booking_duration: '1 hour',
      booking_link: 'https://app.maidhive.test/client/bookings/booking_2',
    })
    expect(requestBody(fetchMock, 2)).toMatchObject({
      transactionalId: 'cmo2rjqam00ao0iy8jfycoz03',
      dataVariables: { first_name: 'Client', cleaner_name: 'Cleaner User' },
    })
    expect(requestBody(fetchMock, 3)).toEqual({
      transactionalId: 'cmo2rozk700gw0izg1w1rhfrf',
      email: 'client@example.test',
      dataVariables: {
        first_name: 'Client',
        cleaner_name: 'Cleaner User',
        all_cleaners_link: 'https://app.maidhive.test/client/cleaners',
      },
    })
    expect(requestBody(fetchMock, 4)).toMatchObject({
      transactionalId: 'cmo2rrvdv2ppa0izkfm5zk7ov',
      dataVariables: {
        first_name: 'Client',
        amount: '€35.20',
        cleaner_name: 'Cleaner User',
        date: '12 Jun 2026',
      },
    })
    expect(requestBody(fetchMock, 5)).toMatchObject({
      transactionalId: 'cmo2rtf800f500iyxs4d16x8x',
      dataVariables: {
        first_name: 'Client',
        cleaner_name: 'Cleaner User',
        review_link: 'https://app.maidhive.test/client/bookings/booking_3',
      },
    })
    expect(requestBody(fetchMock, 6)).toMatchObject({
      transactionalId: 'client-booking-completed-id',
      dataVariables: {
        first_name: 'Client',
        cleaner_name: 'Cleaner User',
        message: 'Your booking has been marked as completed. If there was an issue, please report it within 24 hours.',
        report_link: 'https://app.maidhive.test/client/report?booking=booking_4',
        booking_link: 'https://app.maidhive.test/client/bookings/booking_4',
      },
    })
    expect(requestBody(fetchMock, 7)).toEqual({
      transactionalId: 'cmo2ruvdu07yk0iw5gw79hvew',
      email: 'client@example.test',
      dataVariables: {
        client_name: 'Client User',
        booking_date: '12 Jun 2026',
        booking_link: 'https://app.maidhive.test/client/bookings/booking_5',
      },
    })
    expect(requestBody(fetchMock, 8)).toEqual({
      transactionalId: 'cmr27985005h00j2p70wb14a6',
      email: 'client@example.test',
      dataVariables: {
        client_name: 'Client User',
        cleaner_name: 'Cleaner User',
        booking_date: '12 Jun 2026',
        booking_time: '13:30',
        cancellation_window_message: 'You cancelled between 12 and 24 hours before the scheduled start.',
        cancellation_charge_message: 'Cancellation charge: €5.00.',
        refund_or_release_message: '€30.20 will be refunded or released.',
      },
    })
  })

  it('sends cleaner lifecycle templates with exact IDs and role-specific links', async () => {
    const { loopsEmailService, fetchMock } = await loadLoopsEmailService()
    const scheduledStart = new Date('2026-06-12T10:30:00.000Z')

    await loopsEmailService.sendCleanerBookingCancelledByClient({
      email: 'cleaner@example.test',
      fullName: 'Cleaner User',
      clientName: 'Client User',
      date: scheduledStart,
      durationHours: 2,
      bookingId: 'booking_5',
      cancellationReason: '',
    })
    await loopsEmailService.sendCleanerApplicationApproved({
      email: 'cleaner@example.test',
      fullName: 'Cleaner User',
    })
    await loopsEmailService.sendCleanerNewBookingRequest({
      email: 'cleaner@example.test',
      fullName: 'Cleaner User',
      clientName: 'Client User',
      date: scheduledStart,
      durationHours: 2,
      bookingId: 'booking_6',
    })
    await loopsEmailService.sendCleanerBookingAcceptedConfirmation({
      email: 'cleaner@example.test',
      fullName: 'Cleaner User',
      bookingId: 'booking_7',
    })
    await loopsEmailService.sendCleanerApplicationRejected({
      email: 'cleaner@example.test',
      fullName: 'Cleaner User',
    })
    await loopsEmailService.sendCleanerPayoutNotification({
      email: 'cleaner@example.test',
      fullName: 'Cleaner User',
      amount: 32,
    })
    await loopsEmailService.sendCleanerCancellationWarningOrStrike({
      email: 'cleaner@example.test',
      fullName: 'Cleaner User',
    })

    expect(requestBody(fetchMock, 0)).toEqual({
      transactionalId: 'cmq4ueii70dzh0j2gq00j0bya',
      email: 'cleaner@example.test',
      dataVariables: {
        first_name: 'Cleaner',
        client_name: 'Client User',
        booking_date: '12 Jun 2026',
        booking_time: '13:30',
        cancellation_reason: 'Not provided',
        booking_link: 'https://app.maidhive.test/cleaner/bookings/booking_5',
      },
    })
    expect(requestBody(fetchMock, 1)).toMatchObject({
      transactionalId: 'cmo5hdvco009s0i06469pwe16',
      dataVariables: { first_name: 'Cleaner' },
    })
    expect(requestBody(fetchMock, 2)).toEqual({
      transactionalId: 'cmo5hgm9p00hn0i0fzxhtjsv8',
      email: 'cleaner@example.test',
      dataVariables: {
        first_name: 'Cleaner',
        client_name: 'Client User',
        date: '12 Jun 2026',
        time: '13:30',
        duration: '2 hours',
        booking_link: 'https://app.maidhive.test/cleaner/bookings/booking_6',
      },
    })
    expect(requestBody(fetchMock, 3)).toMatchObject({
      transactionalId: 'cmo5hi2ru00fv0i1swohcrzm2',
      dataVariables: {
        first_name: 'Cleaner',
        booking_link: 'https://app.maidhive.test/cleaner/bookings/booking_7',
      },
    })
    expect(requestBody(fetchMock, 4)).toMatchObject({
      transactionalId: 'cmo5hfgqp00aa0i08rmzp2w8f',
      dataVariables: { first_name: 'Cleaner' },
    })
    expect(requestBody(fetchMock, 5)).toMatchObject({
      transactionalId: 'cmo5hj1953kp50i0ewrbk3wd4',
      dataVariables: { first_name: 'Cleaner', amount: '€32.00' },
    })
    expect(requestBody(fetchMock, 6)).toMatchObject({
      transactionalId: 'cmo5hk2jk09ci0i0x0iala79a',
      dataVariables: { first_name: 'Cleaner' },
    })
  })

  it('sends proposal templates with exact IDs, dates, and neutral fallback copy', async () => {
    const { loopsEmailService, fetchMock } = await loadLoopsEmailService()
    const originalStart = new Date('2026-06-12T10:30:00.000Z')
    const proposedStart = new Date('2026-06-12T12:00:00.000Z')

    await loopsEmailService.sendClientAlternateTimeProposed({
      email: 'client@example.test',
      clientName: 'Client User',
      cleanerName: 'Cleaner User',
      originalStart,
      proposedStart,
    })
    await loopsEmailService.sendCleanerClientAlternateTimeProposed({
      email: 'cleaner@example.test',
      cleanerName: 'Cleaner User',
      clientName: 'Client User',
      originalStart,
      proposedStart,
      requestType: 'Amend Start Time request',
      expiryOutcome: 'Original booking time remains active if declined.',
    })
    await loopsEmailService.sendClientProposalDeclinedClosed({
      email: 'client@example.test',
      clientName: 'Client User',
      cleanerName: 'Cleaner User',
    })
    await loopsEmailService.sendCleanerClientDeclinedProposal({
      email: 'cleaner@example.test',
      cleanerName: 'Cleaner User',
      clientName: 'Client User',
      proposedStart,
    })

    expect(requestBody(fetchMock, 0)).toEqual({
      transactionalId: 'cmoy0itw205fk0ix97hljg7jz',
      email: 'client@example.test',
      dataVariables: {
        clientName: 'Client User',
        cleanerName: 'Cleaner User',
        requestType: 'Alternative time proposal',
        originalDate: '12 Jun 2026',
        originalTime: '13:30',
        proposedDate: '12 Jun 2026',
        proposedTime: '15:00',
        expiryOutcome: 'If this request is declined or expires, the original booking time will remain unchanged.',
      },
    })
    expect(requestBody(fetchMock, 1)).toEqual({
      transactionalId: 'cmoy0pn5w06x10iz4k8dxu3gl',
      email: 'cleaner@example.test',
      dataVariables: {
        cleanerName: 'Cleaner User',
        clientName: 'Client User',
        requestType: 'Amend Start Time request',
        originalDate: '12 Jun 2026',
        originalTime: '13:30',
        proposedDate: '12 Jun 2026',
        proposedTime: '15:00',
        expiryOutcome: 'Original booking time remains active if declined.',
      },
    })
    expect(requestBody(fetchMock, 2)).toMatchObject({
      transactionalId: 'cmozyqayi0xof0iyuyxodgpci',
      dataVariables: { clientName: 'Client User', cleanerName: 'Cleaner User' },
    })
    expect(requestBody(fetchMock, 3)).toMatchObject({
      transactionalId: 'cmozyuhtd2ej10iyplagxg614',
      dataVariables: {
        cleanerName: 'Cleaner User',
        clientName: 'Client User',
        proposedDate: '12 Jun 2026',
        proposedTime: '15:00',
      },
    })
  })

  it('keeps env-only transactional IDs fail-fast when not configured', async () => {
    vi.resetModules()
    vi.stubEnv('LOOPS_API_KEY', 'test-loops-key')
    vi.stubEnv('LOOPS_TRANSACTIONAL_ENDPOINT', 'https://loops.test/transactional')
    vi.stubEnv('LOOPS_CLIENT_BOOKING_STARTED_TRANSACTIONAL_ID', '')
    vi.stubEnv('LOOPS_CLIENT_BOOKING_COMPLETED_TRANSACTIONAL_ID', '')
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { loopsEmailService } = await import('@/server/services/loops-email.service')

    await expect(
      loopsEmailService.sendClientBookingStarted({
        email: 'client@example.test',
        fullName: 'Client User',
        cleanerName: 'Cleaner User',
        scheduledStart: new Date('2026-06-12T10:30:00.000Z'),
        durationHours: 2,
        bookingId: 'booking_1',
      }),
    ).rejects.toThrow('Missing LOOPS_CLIENT_BOOKING_STARTED_TRANSACTIONAL_ID')

    await expect(
      loopsEmailService.sendClientBookingCompleted({
        email: 'client@example.test',
        fullName: 'Client User',
        cleanerName: 'Cleaner User',
        bookingId: 'booking_1',
        completedBy: 'system',
      }),
    ).rejects.toThrow('Missing LOOPS_CLIENT_BOOKING_COMPLETED_TRANSACTIONAL_ID')

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
