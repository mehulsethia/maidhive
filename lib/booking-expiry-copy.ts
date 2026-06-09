type BookingDeadline = { accept_by?: string | null }

function formatDeadline(value?: string | null) {
  if (!value) return null
  return new Date(value).toLocaleString('en-IE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Nicosia',
  })
}

export function getClientBookingRequestDeadlineCopy(booking: BookingDeadline) {
  const deadline = formatDeadline(booking.accept_by)
  if (!deadline) {
    return 'This booking request must be responded to by the cleaner before the response deadline. If no response is received by then, the request will expire automatically and your card authorisation will be released.'
  }
  return `This booking request must be responded to by the cleaner before ${deadline}. If no response is received by then, the request will expire automatically and your card authorisation will be released.`
}

export function getCleanerBookingRequestDeadlineCopy(booking: BookingDeadline) {
  const deadline = formatDeadline(booking.accept_by)
  if (!deadline) {
    return 'Please respond to this booking request before the response deadline. If you do not respond before then, the request will expire automatically.'
  }
  return `Please respond to this booking request before ${deadline}. If you do not respond before then, the request will expire automatically.`
}
