'use client'

const BOOKINGS_REFRESH_EVENT = 'maidhive:bookings-refresh'
const BOOKINGS_REFRESH_CHANNEL = 'maidhive:bookings-refresh-channel'

export type BookingsRefreshPayload = {
  bookingId?: string
  reason?: string
  at?: number
}

let bookingsChannel: BroadcastChannel | null = null

function getBookingsChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  if (!bookingsChannel) {
    bookingsChannel = new BroadcastChannel(BOOKINGS_REFRESH_CHANNEL)
  }
  return bookingsChannel
}

export function triggerBookingsRefresh(payload: BookingsRefreshPayload = {}) {
  if (typeof window === 'undefined') return
  const eventPayload = { ...payload, at: Date.now() }
  window.dispatchEvent(new CustomEvent(BOOKINGS_REFRESH_EVENT, { detail: eventPayload }))
  getBookingsChannel()?.postMessage(eventPayload)
}

export function subscribeBookingsRefresh(
  onRefresh: (payload: BookingsRefreshPayload) => void,
) {
  if (typeof window === 'undefined') return () => {}

  const onWindowEvent = (event: Event) => {
    const payload = (event as CustomEvent<BookingsRefreshPayload>).detail ?? {}
    onRefresh(payload)
  }

  const channel = getBookingsChannel()
  const onChannelMessage = (event: MessageEvent<BookingsRefreshPayload>) => {
    onRefresh(event.data ?? {})
  }

  window.addEventListener(BOOKINGS_REFRESH_EVENT, onWindowEvent as EventListener)
  if (channel) channel.addEventListener('message', onChannelMessage as EventListener)

  return () => {
    window.removeEventListener(BOOKINGS_REFRESH_EVENT, onWindowEvent as EventListener)
    if (channel) channel.removeEventListener('message', onChannelMessage as EventListener)
  }
}
