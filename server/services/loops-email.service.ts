import { cleanerRepo } from '../repositories/cleaner.repo'

const LOOPS_TRANSACTIONAL_ENDPOINT =
  process.env.LOOPS_TRANSACTIONAL_ENDPOINT ?? 'https://app.loops.so/api/v1/transactional'
const LOOPS_API_KEY = process.env.LOOPS_API_KEY ?? ''
const ADMIN_EMAIL = process.env.LOOPS_ADMIN_EMAIL ?? 'sethiamehul14@gmail.com'

const ADMIN_NEW_CLEANER_APPLICATION_TRANSACTIONAL_ID = 'cmo5hnj710d3y0jzuabzw6i6x'
const ADMIN_DISPUTE_RAISED_TRANSACTIONAL_ID = 'cmo5hoydy048w0i0p3io44dlm'
const CLIENT_ACCOUNT_CREATED_TRANSACTIONAL_ID = 'cmo2r81uz0ec30iyxo9lozvlg'
const CLIENT_BOOKING_CONFIRMED_TRANSACTIONAL_ID = 'cmo2rcbtv2p880izkqlj9rxj9'
const CLIENT_BOOKING_STARTED_TRANSACTIONAL_ID =
  process.env.LOOPS_CLIENT_BOOKING_STARTED_TRANSACTIONAL_ID ?? ''
const CLIENT_BOOKING_CREATED_PENDING_TRANSACTIONAL_ID =
  process.env.LOOPS_CLIENT_BOOKING_CREATED_PENDING_TRANSACTIONAL_ID ?? 'cmo2rjqam00ao0iy8jfycoz03'
const CLIENT_BOOKING_REJECTED_OR_EXPIRED_TRANSACTIONAL_ID = 'cmo2rozk700gw0izg1w1rhfrf'
const CLIENT_PAYMENT_RECEIPT_TRANSACTIONAL_ID = 'cmo2rrvdv2ppa0izkfm5zk7ov'
const CLIENT_REVIEW_REQUEST_TRANSACTIONAL_ID = 'cmo2rtf800f500iyxs4d16x8x'
const CLIENT_BOOKING_COMPLETED_TRANSACTIONAL_ID =
  process.env.LOOPS_CLIENT_BOOKING_COMPLETED_TRANSACTIONAL_ID ?? ''
const CLIENT_BOOKING_CANCELLED_BY_CLEANER_TRANSACTIONAL_ID = 'cmo2ruvdu07yk0iw5gw79hvew'
const CLIENT_SELF_CANCELLATION_CONFIRMATION_TRANSACTIONAL_ID = 'cmr27985005h00j2p70wb14a6'
const DISPUTE_SUBMITTED_CONFIRMATION_TRANSACTIONAL_ID = 'cmqf1rb7r7z9q0jx99f8lq615'
const DISPUTE_RAISED_AGAINST_NOTIFICATION_TRANSACTIONAL_ID = 'cmqf1u9ly4ujo0jyq9kfdcfbw'
const DISPUTE_RESOLVED_OUTCOME_TRANSACTIONAL_ID = 'cmrgn2k8m29v60jzktfiu6iap'
const CLEANER_SIGNUP_TRANSACTIONAL_ID = 'cmo5hbjfv0lbm0iya3k626pjl'
const CLEANER_APPLICATION_APPROVED_TRANSACTIONAL_ID = 'cmo5hdvco009s0i06469pwe16'
const CLEANER_NEW_BOOKING_REQUEST_TRANSACTIONAL_ID = 'cmo5hgm9p00hn0i0fzxhtjsv8'
const CLEANER_BOOKING_ACCEPTED_CONFIRMATION_TRANSACTIONAL_ID = 'cmo5hi2ru00fv0i1swohcrzm2'
const CLEANER_APPLICATION_REJECTED_TRANSACTIONAL_ID = 'cmo5hfgqp00aa0i08rmzp2w8f'
const CLEANER_PAYOUT_NOTIFICATION_TRANSACTIONAL_ID = 'cmo5hj1953kp50i0ewrbk3wd4'
const CLEANER_CANCELLATION_WARNING_OR_STRIKE_TRANSACTIONAL_ID = 'cmo5hk2jk09ci0i0x0iala79a'
const CLEANER_BOOKING_CANCELLED_BY_CLIENT_TRANSACTIONAL_ID = 'cmq4ueii70dzh0j2gq00j0bya'
const CLIENT_ALT_TIME_PROPOSED_TRANSACTIONAL_ID =
  process.env.LOOPS_CLIENT_ALT_TIME_PROPOSED_TRANSACTIONAL_ID ?? 'cmoy0itw205fk0ix97hljg7jz'
const CLEANER_CLIENT_ALT_TIME_PROPOSED_TRANSACTIONAL_ID =
  process.env.LOOPS_CLEANER_CLIENT_ALT_TIME_PROPOSED_TRANSACTIONAL_ID ?? 'cmoy0pn5w06x10iz4k8dxu3gl'
const CLIENT_PROPOSAL_DECLINED_CLOSED_TRANSACTIONAL_ID =
  process.env.LOOPS_CLIENT_PROPOSAL_DECLINED_CLOSED_TRANSACTIONAL_ID ?? 'cmozyqayi0xof0iyuyxodgpci'
const CLEANER_CLIENT_DECLINED_PROPOSAL_TRANSACTIONAL_ID =
  process.env.LOOPS_CLEANER_CLIENT_DECLINED_PROPOSAL_TRANSACTIONAL_ID ?? 'cmozyuhtd2ej10iyplagxg614'
const AMENDMENT_REQUEST_EXPIRY_TRANSACTIONAL_ID = 'cmqb0lh2j0fmu0jxihl9pz3qa'
const AMENDMENT_REQUEST_ACCEPTED_TRANSACTIONAL_ID = 'cmqb0soch2eyc0j0170n9yjfh'
const AMENDMENT_REQUEST_DECLINED_TRANSACTIONAL_ID = 'cmqf2hr134x6k0jyq8c6kg4d7'

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
}

type SendTransactionalPayload = {
  transactionalId: string
  email: string
  dataVariables: Record<string, string>
}

async function sendTransactionalEmail(payload: SendTransactionalPayload) {
  if (!LOOPS_API_KEY) {
    throw new Error('Missing LOOPS_API_KEY')
  }
  const transactionalId = payload.transactionalId.trim()
  if (!transactionalId || transactionalId.includes('@')) {
    throw new Error('Invalid Loops transactionalId. Set a valid LOOPS_*_TRANSACTIONAL_ID value.')
  }
  if (!payload.email?.trim()) {
    throw new Error('Missing recipient email address for Loops transactional send')
  }

  const res = await fetch(LOOPS_TRANSACTIONAL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOOPS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      transactionalId,
      email: payload.email.trim(),
    }),
  })

  if (res.ok) return

  const responseText = await res.text().catch(() => '')
  throw new Error(`Loops request failed (${res.status}): ${responseText || 'No response body'}`)
}

function formatBookingDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: 'Europe/Nicosia',
  }).format(date)
}

function formatBookingTime(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Nicosia',
  }).format(date)
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function firstName(fullName: string) {
  const trimmed = fullName.trim()
  if (!trimmed) return 'there'
  return trimmed.split(/\s+/)[0] ?? 'there'
}

function absoluteAppLink(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${appUrl()}${normalizedPath}`
}

async function resolveBookingConfirmationNotes(args: {
  cleanerId: string
  cleanerName: string
  transportMode?: string | null
  transportPickupLocation?: string | null
  cleaningSupplies?: string | null
}) {
  let transportMode = args.transportMode ?? null
  let transportPickupLocation = args.transportPickupLocation ?? null
  let cleaningSupplies = args.cleaningSupplies ?? null

  if (
    !transportMode ||
    !cleaningSupplies ||
    (transportMode === 'requires_pickup' && !transportPickupLocation)
  ) {
    const cleaner = await cleanerRepo.findById(args.cleanerId)
    transportMode = transportMode ?? cleaner?.transportMode ?? null
    transportPickupLocation = transportPickupLocation ?? cleaner?.transportPickupLocation ?? null
    cleaningSupplies = cleaningSupplies ?? cleaner?.cleaningSupplies ?? null
  }

  const pickupLocation = (transportPickupLocation ?? '').trim() || 'the agreed pickup location'
  const transportNote =
    transportMode === 'requires_pickup'
      ? `${args.cleanerName} requires a pickup and drop-off. Please arrange transport to: ${pickupLocation}`
      : `${args.cleanerName} will make their own way to you.`

  const suppliesNote =
    cleaningSupplies !== 'own_supplies'
      ? 'Please ensure cleaning supplies are available before the session starts.'
      : `${args.cleanerName} will bring their own supplies.`

  return { transportNote, suppliesNote }
}

export const loopsEmailService = {
  async sendAdminNewCleanerApplication(args: { cleanerName: string; cleanerEmail: string }) {
    return sendTransactionalEmail({
      transactionalId: ADMIN_NEW_CLEANER_APPLICATION_TRANSACTIONAL_ID,
      email: ADMIN_EMAIL,
      dataVariables: {
        cleaner_name: args.cleanerName,
        cleaner_email: args.cleanerEmail,
        admin_link: `${appUrl()}/admin/cleaners`,
      },
    })
  },

  async sendAdminDisputeRaised(args: {
    bookingId: string
    clientName: string
    cleanerName: string
    date: string
  }) {
    return sendTransactionalEmail({
      transactionalId: ADMIN_DISPUTE_RAISED_TRANSACTIONAL_ID,
      email: ADMIN_EMAIL,
      dataVariables: {
        booking_id: args.bookingId,
        client_name: args.clientName,
        cleaner_name: args.cleanerName,
        date: args.date,
        admin_link: `${appUrl()}/admin/disputes`,
      },
    })
  },

  async sendClientAccountCreated(args: { email: string; fullName: string }) {
    return sendTransactionalEmail({
      transactionalId: CLIENT_ACCOUNT_CREATED_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        all_cleaners_link: `${appUrl()}/client/cleaners`,
      },
    })
  },

  async sendClientBookingConfirmed(args: {
    email: string
    fullName: string
    cleanerId: string
    cleanerName: string
    scheduledStart: Date
    durationHours: number
    bookingId: string
    transportMode?: string | null
    transportPickupLocation?: string | null
    cleaningSupplies?: string | null
  }) {
    const { transportNote, suppliesNote } = await resolveBookingConfirmationNotes({
      cleanerId: args.cleanerId,
      cleanerName: args.cleanerName,
      transportMode: args.transportMode,
      transportPickupLocation: args.transportPickupLocation,
      cleaningSupplies: args.cleaningSupplies,
    })

    return sendTransactionalEmail({
      transactionalId: CLIENT_BOOKING_CONFIRMED_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        cleaner_name: args.cleanerName,
        booking_date: formatBookingDate(args.scheduledStart),
        booking_time: formatBookingTime(args.scheduledStart),
        booking_duration: `${args.durationHours} hour${args.durationHours === 1 ? '' : 's'}`,
        transport_note: transportNote,
        supplies_note: suppliesNote,
        booking_link: `${appUrl()}/client/bookings/${args.bookingId}`,
      },
    })
  },

  async sendClientBookingStarted(args: {
    email: string
    fullName: string
    cleanerName: string
    scheduledStart: Date
    durationHours: number
    bookingId: string
  }) {
    if (!CLIENT_BOOKING_STARTED_TRANSACTIONAL_ID.trim()) {
      throw new Error('Missing LOOPS_CLIENT_BOOKING_STARTED_TRANSACTIONAL_ID')
    }
    return sendTransactionalEmail({
      transactionalId: CLIENT_BOOKING_STARTED_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        cleaner_name: args.cleanerName,
        booking_date: formatBookingDate(args.scheduledStart),
        booking_time: formatBookingTime(args.scheduledStart),
        booking_duration: `${args.durationHours} hour${args.durationHours === 1 ? '' : 's'}`,
        booking_link: `${appUrl()}/client/bookings/${args.bookingId}`,
      },
    })
  },

  async sendClientBookingCreatedPending(args: {
    email: string
    fullName: string
    cleanerName: string
  }) {
    return sendTransactionalEmail({
      transactionalId: CLIENT_BOOKING_CREATED_PENDING_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        cleaner_name: args.cleanerName,
      },
    })
  },

  async sendClientBookingRejectedOrExpired(args: {
    email: string
    fullName: string
    cleanerName: string
  }) {
    return sendTransactionalEmail({
      transactionalId: CLIENT_BOOKING_REJECTED_OR_EXPIRED_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        cleaner_name: args.cleanerName,
        all_cleaners_link: `${appUrl()}/client/cleaners`,
      },
    })
  },

  async sendClientPaymentReceipt(args: {
    email: string
    fullName: string
    amount: number
    cleanerName: string
    date: Date
  }) {
    return sendTransactionalEmail({
      transactionalId: CLIENT_PAYMENT_RECEIPT_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        amount: formatEuro(args.amount),
        cleaner_name: args.cleanerName,
        date: formatBookingDate(args.date),
      },
    })
  },

  async sendClientReviewRequest(args: {
    email: string
    fullName: string
    cleanerName: string
    bookingId: string
  }) {
    return sendTransactionalEmail({
      transactionalId: CLIENT_REVIEW_REQUEST_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        cleaner_name: args.cleanerName,
        review_link: `${appUrl()}/client/bookings/${args.bookingId}`,
      },
    })
  },

  async sendClientBookingCompleted(args: {
    email: string
    fullName: string
    cleanerName: string
    bookingId: string
    completedBy: 'cleaner' | 'system'
  }) {
    const message =
      args.completedBy === 'system'
        ? 'Your booking has been marked as completed. If there was an issue, please report it within 24 hours.'
        : 'Cleaner marked this booking as completed. If there was an issue, please report it within 24 hours.'

    if (!CLIENT_BOOKING_COMPLETED_TRANSACTIONAL_ID.trim()) {
      throw new Error('Missing LOOPS_CLIENT_BOOKING_COMPLETED_TRANSACTIONAL_ID')
    }

    return sendTransactionalEmail({
      transactionalId: CLIENT_BOOKING_COMPLETED_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        cleaner_name: args.cleanerName,
        message,
        report_link: `${appUrl()}/client/report?booking=${args.bookingId}`,
        booking_link: `${appUrl()}/client/bookings/${args.bookingId}`,
      },
    })
  },

  async sendClientBookingCancelledByCleaner(args: {
    email: string
    fullName: string
    date: Date
    bookingId: string
  }) {
    return sendTransactionalEmail({
      transactionalId: CLIENT_BOOKING_CANCELLED_BY_CLEANER_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        client_name: args.fullName,
        booking_date: formatBookingDate(args.date),
        booking_link: `${appUrl()}/client/bookings/${args.bookingId}`,
      },
    })
  },

  async sendClientSelfCancellationConfirmation(args: {
    email: string
    clientName: string
    cleanerName: string
    bookingDate: Date
    cancellationWindowMessage: string
    cancellationChargeMessage: string
    refundOrReleaseMessage: string
  }) {
    return sendTransactionalEmail({
      transactionalId: CLIENT_SELF_CANCELLATION_CONFIRMATION_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        client_name: args.clientName,
        cleaner_name: args.cleanerName,
        booking_date: formatBookingDate(args.bookingDate),
        booking_time: formatBookingTime(args.bookingDate),
        cancellation_window_message: args.cancellationWindowMessage,
        cancellation_charge_message: args.cancellationChargeMessage,
        refund_or_release_message: args.refundOrReleaseMessage,
      },
    })
  },

  async sendDisputeSubmittedConfirmation(args: {
    email: string
    fullName: string
    bookingReference: string
    issueType: string
    disputePath: string
    statusMessage?: string
  }) {
    return sendTransactionalEmail({
      transactionalId: DISPUTE_SUBMITTED_CONFIRMATION_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        booking_reference: args.bookingReference,
        issue_type: args.issueType,
        dispute_link: absoluteAppLink(args.disputePath),
        ...(args.statusMessage ? { status_message: args.statusMessage } : {}),
      },
    })
  },

  async sendDisputeRaisedAgainstNotification(args: {
    email: string
    fullName: string
    bookingReference: string
    issueType: string
    disputePath: string
  }) {
    return sendTransactionalEmail({
      transactionalId: DISPUTE_RAISED_AGAINST_NOTIFICATION_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        booking_reference: args.bookingReference,
        issue_type: args.issueType,
        dispute_link: absoluteAppLink(args.disputePath),
      },
    })
  },

  async sendDisputeResolvedOutcome(args: {
    email: string
    fullName: string
    bookingReference: string
    resolutionOutcome: string
    refundAmount?: number | null
    cleanerPayoutOutcome: string
    resolutionNote: string
  }) {
    return sendTransactionalEmail({
      transactionalId: DISPUTE_RESOLVED_OUTCOME_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        booking_reference: args.bookingReference,
        resolution_outcome: args.resolutionOutcome,
        refund_amount:
          args.refundAmount != null && args.refundAmount > 0
            ? formatEuro(args.refundAmount)
            : 'Not applicable',
        cleaner_payout_outcome: args.cleanerPayoutOutcome,
        resolution_note: args.resolutionNote.trim() || 'No additional note provided.',
      },
    })
  },

  async sendCleanerBookingCancelledByClient(args: {
    email: string
    fullName: string
    clientName: string
    date: Date
    durationHours: number
    bookingId: string
    cancellationReason?: string
  }) {
    return sendTransactionalEmail({
      transactionalId: CLEANER_BOOKING_CANCELLED_BY_CLIENT_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        client_name: args.clientName,
        booking_date: formatBookingDate(args.date),
        booking_time: formatBookingTime(args.date),
        cancellation_reason: args.cancellationReason?.trim() || 'Not provided',
        booking_link: `${appUrl()}/cleaner/bookings/${args.bookingId}`,
      },
    })
  },

  async sendCleanerSignup(args: { email: string; fullName: string }) {
    return sendTransactionalEmail({
      transactionalId: CLEANER_SIGNUP_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        cta_link: `${appUrl()}/cleaner/onboarding`,
      },
    })
  },

  async sendCleanerApplicationApproved(args: { email: string; fullName: string }) {
    return sendTransactionalEmail({
      transactionalId: CLEANER_APPLICATION_APPROVED_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
      },
    })
  },

  async sendCleanerNewBookingRequest(args: {
    email: string
    fullName: string
    clientName: string
    date: Date
    durationHours: number
    bookingId: string
  }) {
    return sendTransactionalEmail({
      transactionalId: CLEANER_NEW_BOOKING_REQUEST_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        client_name: args.clientName,
        date: formatBookingDate(args.date),
        time: formatBookingTime(args.date),
        duration: `${args.durationHours} hour${args.durationHours === 1 ? '' : 's'}`,
        booking_link: `${appUrl()}/cleaner/bookings/${args.bookingId}`,
      },
    })
  },

  async sendCleanerBookingAcceptedConfirmation(args: {
    email: string
    fullName: string
    bookingId: string
  }) {
    return sendTransactionalEmail({
      transactionalId: CLEANER_BOOKING_ACCEPTED_CONFIRMATION_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        booking_link: `${appUrl()}/cleaner/bookings/${args.bookingId}`,
      },
    })
  },

  async sendCleanerApplicationRejected(args: { email: string; fullName: string }) {
    return sendTransactionalEmail({
      transactionalId: CLEANER_APPLICATION_REJECTED_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
      },
    })
  },

  async sendCleanerPayoutNotification(args: {
    email: string
    fullName: string
    amount: number
  }) {
    return sendTransactionalEmail({
      transactionalId: CLEANER_PAYOUT_NOTIFICATION_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        amount: formatEuro(args.amount),
      },
    })
  },

  async sendCleanerCancellationWarningOrStrike(args: { email: string; fullName: string }) {
    return sendTransactionalEmail({
      transactionalId: CLEANER_CANCELLATION_WARNING_OR_STRIKE_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
      },
    })
  },

  async sendClientAlternateTimeProposed(args: {
    email: string
    clientName: string
    cleanerName: string
    originalStart: Date
    proposedStart: Date
    requestType?: string
    expiryOutcome?: string
  }) {
    return sendTransactionalEmail({
      transactionalId: CLIENT_ALT_TIME_PROPOSED_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        clientName: args.clientName,
        cleanerName: args.cleanerName,
        requestType: args.requestType ?? 'Alternative time proposal',
        originalDate: formatBookingDate(args.originalStart),
        originalTime: formatBookingTime(args.originalStart),
        proposedDate: formatBookingDate(args.proposedStart),
        proposedTime: formatBookingTime(args.proposedStart),
        expiryOutcome: args.expiryOutcome ?? 'If this request is declined or expires, the original booking time will remain unchanged.',
      },
    })
  },

  async sendCleanerClientAlternateTimeProposed(args: {
    email: string
    cleanerName: string
    clientName: string
    originalStart: Date
    proposedStart: Date
    requestType?: string
    expiryOutcome?: string
  }) {
    return sendTransactionalEmail({
      transactionalId: CLEANER_CLIENT_ALT_TIME_PROPOSED_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        cleanerName: args.cleanerName,
        clientName: args.clientName,
        requestType: args.requestType ?? 'Alternative time proposal',
        originalDate: formatBookingDate(args.originalStart),
        originalTime: formatBookingTime(args.originalStart),
        proposedDate: formatBookingDate(args.proposedStart),
        proposedTime: formatBookingTime(args.proposedStart),
        expiryOutcome: args.expiryOutcome ?? 'If this request is declined or expires, the original booking time will remain unchanged.',
      },
    })
  },

  async sendClientProposalDeclinedClosed(args: {
    email: string
    clientName: string
    cleanerName: string
  }) {
    return sendTransactionalEmail({
      transactionalId: CLIENT_PROPOSAL_DECLINED_CLOSED_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        clientName: args.clientName,
        cleanerName: args.cleanerName,
      },
    })
  },

  async sendCleanerClientDeclinedProposal(args: {
    email: string
    cleanerName: string
    clientName: string
    proposedStart: Date
  }) {
    return sendTransactionalEmail({
      transactionalId: CLEANER_CLIENT_DECLINED_PROPOSAL_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        cleanerName: args.cleanerName,
        clientName: args.clientName,
        proposedDate: formatBookingDate(args.proposedStart),
        proposedTime: formatBookingTime(args.proposedStart),
      },
    })
  },

  async sendAmendmentRequestExpired(args: {
    email: string
    fullName: string
    scheduledStart: Date
  }) {
    return sendTransactionalEmail({
      transactionalId: AMENDMENT_REQUEST_EXPIRY_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        FirstName: firstName(args.fullName),
        Date: formatBookingDate(args.scheduledStart),
        Time: formatBookingTime(args.scheduledStart),
      },
    })
  },

  async sendAmendmentRequestAccepted(args: {
    email: string
    fullName: string
    originalStart: Date
    newStart: Date
  }) {
    return sendTransactionalEmail({
      transactionalId: AMENDMENT_REQUEST_ACCEPTED_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        FirstName: firstName(args.fullName),
        OriginalDate: formatBookingDate(args.originalStart),
        OriginalTime: formatBookingTime(args.originalStart),
        NewDate: formatBookingDate(args.newStart),
        NewTime: formatBookingTime(args.newStart),
      },
    })
  },

  async sendAmendmentRequestDeclined(args: {
    email: string
    fullName: string
    originalStart: Date
  }) {
    return sendTransactionalEmail({
      transactionalId: AMENDMENT_REQUEST_DECLINED_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        FirstName: firstName(args.fullName),
        OriginalDate: formatBookingDate(args.originalStart),
        OriginalTime: formatBookingTime(args.originalStart),
      },
    })
  },
}
