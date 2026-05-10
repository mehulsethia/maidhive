const LOOPS_TRANSACTIONAL_ENDPOINT =
  process.env.LOOPS_TRANSACTIONAL_ENDPOINT ?? 'https://app.loops.so/api/v1/transactional'
const LOOPS_API_KEY = process.env.LOOPS_API_KEY ?? ''
const ADMIN_EMAIL = process.env.LOOPS_ADMIN_EMAIL ?? 'sethiamehul14@gmail.com'

const ADMIN_NEW_CLEANER_APPLICATION_TRANSACTIONAL_ID = 'cmo5hnj710d3y0jzuabzw6i6x'
const ADMIN_DISPUTE_RAISED_TRANSACTIONAL_ID = 'cmo5hoydy048w0i0p3io44dlm'
const CLIENT_ACCOUNT_CREATED_TRANSACTIONAL_ID = 'cmo2r81uz0ec30iyxo9lozvlg'
const CLIENT_BOOKING_CONFIRMED_TRANSACTIONAL_ID = 'cmo2rcbtv2p880izkqlj9rxj9'
const CLIENT_BOOKING_CREATED_PENDING_TRANSACTIONAL_ID =
  process.env.LOOPS_CLIENT_BOOKING_CREATED_PENDING_TRANSACTIONAL_ID ?? 'cmo2rjqam00ao0iy8jfycoz03'
const CLIENT_BOOKING_REJECTED_OR_EXPIRED_TRANSACTIONAL_ID = 'cmo2rozk700gw0izg1w1rhfrf'
const CLIENT_PAYMENT_RECEIPT_TRANSACTIONAL_ID = 'cmo2rrvdv2ppa0izkfm5zk7ov'
const CLIENT_REVIEW_REQUEST_TRANSACTIONAL_ID = 'cmo2rtf800f500iyxs4d16x8x'
const CLIENT_BOOKING_COMPLETED_TRANSACTIONAL_ID =
  process.env.LOOPS_CLIENT_BOOKING_COMPLETED_TRANSACTIONAL_ID ?? 'cmo2rtf800f500iyxs4d16x8x'
const CLIENT_CANCELLATION_CONFIRMATION_TRANSACTIONAL_ID = 'cmo2ruvdu07yk0iw5gw79hvew'
const CLIENT_ISSUE_OR_NOSHOW_NOTIFICATION_TRANSACTIONAL_ID = 'cmo2rwfnv2p3t0izcpaqf74tc'
const CLEANER_SIGNUP_TRANSACTIONAL_ID = 'cmo5hbjfv0lbm0iya3k626pjl'
const CLEANER_APPLICATION_APPROVED_TRANSACTIONAL_ID = 'cmo5hdvco009s0i06469pwe16'
const CLEANER_NEW_BOOKING_REQUEST_TRANSACTIONAL_ID = 'cmo5hgm9p00hn0i0fzxhtjsv8'
const CLEANER_BOOKING_ACCEPTED_CONFIRMATION_TRANSACTIONAL_ID = 'cmo5hi2ru00fv0i1swohcrzm2'
const CLEANER_APPLICATION_REJECTED_TRANSACTIONAL_ID = 'cmo5hfgqp00aa0i08rmzp2w8f'
const CLEANER_PAYOUT_NOTIFICATION_TRANSACTIONAL_ID = 'cmo5hj1953kp50i0ewrbk3wd4'
const CLEANER_CANCELLATION_WARNING_OR_STRIKE_TRANSACTIONAL_ID = 'cmo5hk2jk09ci0i0x0iala79a'
const CLIENT_ALT_TIME_PROPOSED_TRANSACTIONAL_ID =
  process.env.LOOPS_CLIENT_ALT_TIME_PROPOSED_TRANSACTIONAL_ID ?? 'cmoy0itw205fk0ix97hljg7jz'
const CLEANER_CLIENT_ALT_TIME_PROPOSED_TRANSACTIONAL_ID =
  process.env.LOOPS_CLEANER_CLIENT_ALT_TIME_PROPOSED_TRANSACTIONAL_ID ?? 'cmoy0pn5w06x10iz4k8dxu3gl'
const CLIENT_PROPOSAL_DECLINED_CLOSED_TRANSACTIONAL_ID =
  process.env.LOOPS_CLIENT_PROPOSAL_DECLINED_CLOSED_TRANSACTIONAL_ID ?? 'cmozyqayi0xof0iyuyxodgpci'
const CLEANER_CLIENT_DECLINED_PROPOSAL_TRANSACTIONAL_ID =
  process.env.LOOPS_CLEANER_CLIENT_DECLINED_PROPOSAL_TRANSACTIONAL_ID ?? 'cmozyuhtd2ej10iyplagxg614'

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
    cleanerName: string
    scheduledStart: Date
    durationHours: number
    bookingId: string
  }) {
    return sendTransactionalEmail({
      transactionalId: CLIENT_BOOKING_CONFIRMED_TRANSACTIONAL_ID,
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

  async sendClientCancellationConfirmation(args: {
    email: string
    fullName: string
    date: Date
    cleanerName?: string
    durationHours?: number
  }) {
    return sendTransactionalEmail({
      transactionalId: CLIENT_CANCELLATION_CONFIRMATION_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        date: formatBookingDate(args.date),
        time: formatBookingTime(args.date),
        cleaner_name: args.cleanerName ?? 'Cleaner',
        booking_duration: args.durationHours
          ? `${args.durationHours} hour${args.durationHours === 1 ? '' : 's'}`
          : '',
        cta_link: `${appUrl()}/client/bookings`,
      },
    })
  },

  async sendClientIssueOrNoShowNotification(args: {
    email: string
    fullName: string
    bookingId: string
  }) {
    return sendTransactionalEmail({
      transactionalId: CLIENT_ISSUE_OR_NOSHOW_NOTIFICATION_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        first_name: firstName(args.fullName),
        dispute_link: `${appUrl()}/client/report?booking=${args.bookingId}`,
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
  }) {
    return sendTransactionalEmail({
      transactionalId: CLIENT_ALT_TIME_PROPOSED_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        clientName: args.clientName,
        cleanerName: args.cleanerName,
        originalDate: formatBookingDate(args.originalStart),
        originalTime: formatBookingTime(args.originalStart),
        proposedDate: formatBookingDate(args.proposedStart),
        proposedTime: formatBookingTime(args.proposedStart),
      },
    })
  },

  async sendCleanerClientAlternateTimeProposed(args: {
    email: string
    cleanerName: string
    clientName: string
    originalStart: Date
    proposedStart: Date
  }) {
    return sendTransactionalEmail({
      transactionalId: CLEANER_CLIENT_ALT_TIME_PROPOSED_TRANSACTIONAL_ID,
      email: args.email,
      dataVariables: {
        cleanerName: args.cleanerName,
        clientName: args.clientName,
        originalDate: formatBookingDate(args.originalStart),
        originalTime: formatBookingTime(args.originalStart),
        proposedDate: formatBookingDate(args.proposedStart),
        proposedTime: formatBookingTime(args.proposedStart),
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
}
