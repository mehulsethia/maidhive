export type PickupLocationStructured = {
  label: string
  address: string
  city: 'Larnaca'
  country: 'Cyprus'
  postcode?: string
  meetNotes?: string
}

const PREFIX = 'pickup_v2:'

export function parsePickupLocation(value?: string | null): PickupLocationStructured | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  if (!raw.startsWith(PREFIX)) return null
  try {
    const parsed = JSON.parse(raw.slice(PREFIX.length))
    const label = String(parsed?.label ?? '').trim()
    const address = String(parsed?.address ?? '').trim()
    const city = String(parsed?.city ?? '').trim()
    const country = String(parsed?.country ?? '').trim()
    const postcode = String(parsed?.postcode ?? '').trim()
    const meetNotes = String(parsed?.meetNotes ?? '').trim()
    if (!label || !address || city !== 'Larnaca' || country !== 'Cyprus') return null
    return {
      label,
      address,
      city: 'Larnaca',
      country: 'Cyprus',
      ...(postcode ? { postcode } : {}),
      ...(meetNotes ? { meetNotes } : {}),
    }
  } catch {
    return null
  }
}

export function serializePickupLocation(payload: PickupLocationStructured): string {
  return `${PREFIX}${JSON.stringify(payload)}`
}

export function pickupShortLabel(value?: string | null): string {
  const structured = parsePickupLocation(value)
  if (structured) return `${structured.label}, Larnaca`
  const fallback = String(value ?? '').trim()
  if (!fallback) return ''
  return fallback
}

export function pickupFullLabel(value?: string | null): string {
  const structured = parsePickupLocation(value)
  if (structured) {
    const parts = [structured.label, structured.address, 'Larnaca']
    if (structured.postcode) parts.push(structured.postcode)
    return parts
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part, index, arr) => arr.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index)
      .join(', ')
  }
  const fallback = String(value ?? '').trim()
  if (!fallback) return ''
  return fallback
}
