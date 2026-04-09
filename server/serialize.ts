/**
 * Generic Prisma → API serializer.
 *
 * Prisma returns camelCase field names (e.g. `serviceType`, `cleanerPayout`).
 * The frontend expects snake_case (e.g. `service_type`, `cleaner_payout`).
 * This module bridges the two by recursively converting keys and coercing
 * Prisma Decimal / Date types to JSON-friendly primitives.
 */

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

function isDecimal(value: unknown): value is { toNumber(): number } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'toNumber' in (value as Record<string, unknown>) &&
    typeof (value as any).toNumber === 'function'
  )
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString()
  if (isDecimal(value)) return value.toNumber()
  if (Array.isArray(value)) return value.map(serializeValue)
  if (typeof value === 'object') return serializeRecord(value as Record<string, unknown>)
  return value
}

function serializeRecord(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = serializeValue(value)
  }
  return result
}

/**
 * Recursively convert a Prisma result (or array of results) from camelCase
 * to snake_case, coercing Decimal → number and Date → ISO string.
 */
export function serialize<T = unknown>(data: unknown): T {
  return serializeValue(data) as T
}
