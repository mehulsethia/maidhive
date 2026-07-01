function sanitizeValue(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function getCleaningSuppliesResponsibility(value?: string) {
  const normalized = sanitizeValue(value ?? '').toLowerCase()
  if (!normalized) return undefined
  if (
    normalized === 'client_provides' ||
    normalized === 'client provides' ||
    normalized.includes('i will provide') ||
    normalized.includes('client-provided')
  ) {
    return 'Provided by client'
  }
  if (
    normalized === 'cleaner_brings' ||
    normalized === 'own_supplies' ||
    normalized.includes('cleaner should bring') ||
    normalized.includes('cleaner will bring')
  ) {
    return 'Provided by cleaner'
  }
  return value
}
