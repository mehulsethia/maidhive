import { expect, type APIRequestContext, type BrowserContext, type Page, type TestInfo } from '@playwright/test'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { config as loadDotenv } from 'dotenv'

loadDotenv({ path: '.env.local' })

type Role = 'client' | 'cleaner' | 'admin'

type Credentials = {
  email: string
  password: string
}

type ApiEnvelope<T> = {
  success: boolean
  data: T
  message?: string
}

type HttpResponseLike = {
  ok(): boolean
  status(): number
  json(): Promise<unknown>
  text(): Promise<string>
}

function credentialsFromEnv(role: Role): Credentials | null {
  const upper = role.toUpperCase()
  const email = process.env[`E2E_${upper}_EMAIL`]
  const password = process.env[`E2E_${upper}_PASSWORD`]
  if (!email || !password) return null
  return { email, password }
}

function credentialMatches(a: Credentials, b: Credentials) {
  return a.email.toLowerCase() === b.email.toLowerCase() && a.password === b.password
}

function getCredentialCandidatesForRole(role: Role): Credentials[] {
  const preferred = credentialsFromEnv(role)
  const fallbackRoles: Role[] = ['client', 'cleaner', 'admin']
  const pool = fallbackRoles.map(credentialsFromEnv).filter((item): item is Credentials => Boolean(item))

  const unique: Credentials[] = []
  if (preferred) unique.push(preferred)
  for (const creds of pool) {
    if (!unique.some((existing) => credentialMatches(existing, creds))) unique.push(creds)
  }
  return unique
}

const probedCredentialRole = new Map<string, Role | null>()
const resolvedCredentialsByRole = new Map<Role, Credentials | null>()

function credentialKey(creds: Credentials): string {
  return `${creds.email.toLowerCase()}::${creds.password}`
}

function toRole(value: string): Role | null {
  if (value === 'client' || value === 'cleaner' || value === 'admin') return value
  return null
}

async function probeCredentialRole(creds: Credentials): Promise<Role | null> {
  const key = credentialKey(creds)
  const cached = probedCredentialRole.get(key)
  if (cached !== undefined) return cached

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    probedCredentialRole.set(key, null)
    return null
  }

  const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: creds.email,
      password: creds.password,
    })
    if (error) {
      probedCredentialRole.set(key, null)
      return null
    }
    const role = toRole(String(data.user?.user_metadata?.role ?? '').toLowerCase())
    probedCredentialRole.set(key, role)
    await supabase.auth.signOut()
    return role
  } catch {
    probedCredentialRole.set(key, null)
    return null
  }
}

async function resolveCredentialsForRole(role: Role): Promise<Credentials | null> {
  const cached = resolvedCredentialsByRole.get(role)
  if (cached !== undefined) return cached

  const candidates = getCredentialCandidatesForRole(role)
  for (const candidate of candidates) {
    const probedRole = await probeCredentialRole(candidate)
    if (probedRole === role) {
      resolvedCredentialsByRole.set(role, candidate)
      return candidate
    }
  }

  resolvedCredentialsByRole.set(role, null)
  return null
}

export function getRoleCredentials(role: Role): Credentials | null {
  return credentialsFromEnv(role)
}

export function hasRoleCredentialCandidates(role: Role): boolean {
  return getCredentialCandidatesForRole(role).length > 0
}

export function getPaymentMethodId() {
  return process.env.E2E_CLIENT_PAYMENT_METHOD_ID ?? ''
}

export async function loginAsRole(page: Page, role: Role) {
  const creds = await resolveCredentialsForRole(role)
  if (!creds) {
    const availableEmails = getCredentialCandidatesForRole(role)
      .map((c) => c.email)
      .join(', ')
    throw new Error(
      `Could not resolve credentials for role "${role}" with available E2E candidates: ${availableEmails}`,
    )
  }

  await page.context().clearCookies()
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    try {
      window.localStorage.clear()
      window.sessionStorage.clear()
    } catch {
      // Non-fatal.
    }
  })
  await page.goto('/login', { waitUntil: 'domcontentloaded' })

  await page.getByPlaceholder('Enter your email').fill(creds.email)
  await page.getByPlaceholder('Enter your password').fill(creds.password)
  await page.getByRole('button', { name: 'Log in' }).click()

  try {
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 })
  } catch {
    // Surface rich diagnostics below when still on /login.
  }
  await page.waitForLoadState('networkidle')

  if (page.url().includes('/login')) {
    const bodyText = (await page.locator('body').innerText()).trim().slice(0, 500)
    throw new Error(
      `Login did not navigate away from /login for role "${role}". ` +
        `Resolved account: ${creds.email}. Current URL: ${page.url()}. Page snippet: ${bodyText}`,
    )
  }

  const meRes = await page.request.get('/api/v1/auth/me')
  const me = await parseApiResponse<{ role?: string }>(meRes)
  const actualRole = String(me.data.role ?? '').toLowerCase()
  expect(actualRole, `Resolved account role mismatch for ${creds.email}`).toBe(role)

  return creds
}

export async function parseApiResponse<T>(response: HttpResponseLike, testInfo?: TestInfo): Promise<ApiEnvelope<T>> {
  const rawText = await response.text()
  let json: ApiEnvelope<T>
  try {
    json = JSON.parse(rawText) as ApiEnvelope<T>
  } catch {
    if (testInfo) {
      await testInfo.attach('api-non-json-response', {
        contentType: 'text/plain',
        body: Buffer.from(`status=${response.status()}\n\n${rawText}`),
      })
    }
    throw new Error(`Expected JSON API response, got non-JSON payload (status ${response.status()}).`)
  }
  if (!response.ok() || !json.success) {
    if (testInfo) {
      await testInfo.attach('api-error-response', {
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify({ status: response.status(), body: json }, null, 2)),
      })
    }
  }
  expect(response.ok(), `API status ${response.status()}`).toBeTruthy()
  expect(json.success).toBeTruthy()
  return json
}

type CleanerSummary = {
  id: string
  hourly_rate: number
}

type AvailabilitySlot = {
  start: string
  disabled?: boolean
}

type CreatedBooking = {
  id: string
  cleaner_id: string
  total_amount: number
  subtotal?: number
  platform_fee?: number
  cleaner_payout?: number
  hourly_rate?: number
  status: string
}

export async function getFirstCleaner(request: APIRequestContext, testInfo?: TestInfo): Promise<CleanerSummary> {
  const res = await request.get('/api/v1/cleaners?page=1&page_size=1')
  const parsed = await parseApiResponse<{ cleaners: CleanerSummary[] }>(res, testInfo)
  const cleaner = parsed.data.cleaners?.[0]
  expect(cleaner, 'No approved cleaner returned from /api/v1/cleaners').toBeTruthy()
  return cleaner
}

export function getAuthedRequest(context: BrowserContext) {
  return context.request
}

export async function getFirstBookableSlot(
  request: APIRequestContext,
  cleanerId: string,
  durationHours: number,
  testInfo?: TestInfo,
) {
  const datesRes = await request.get(
    `/api/v1/availability/${cleanerId}/dates?duration_hours=${durationHours}&days_ahead=28`,
  )
  const datesParsed = await parseApiResponse<string[]>(datesRes, testInfo)
  const date = datesParsed.data[0]
  expect(date, 'No bookable dates returned').toBeTruthy()

  const slotsRes = await request.get(
    `/api/v1/availability/${cleanerId}/slots?date=${encodeURIComponent(date)}&duration_hours=${durationHours}`,
  )
  const slotsParsed = await parseApiResponse<AvailabilitySlot[]>(slotsRes, testInfo)
  const slot = (slotsParsed.data ?? []).find((item) => !item.disabled)?.start
  expect(slot, 'No enabled slots returned').toBeTruthy()

  return { date, slot: String(slot) }
}

export async function createDraftBooking(
  request: APIRequestContext,
  options: {
    cleanerId: string
    scheduledStart: string
    durationHours: number
    serviceType?: 'standard' | 'deep_clean' | 'end_of_tenancy' | 'move_in'
  },
  testInfo?: TestInfo,
): Promise<CreatedBooking> {
  const payload = {
    cleaner_id: options.cleanerId,
    service_type: options.serviceType ?? 'standard',
    special_instructions: 'Please clean kitchen surfaces and mop floors carefully.',
    address: '1 Test Street',
    city: 'Larnaca',
    postcode: '6020',
    country: 'CY',
    apartment_details: 'Flat 2',
    access_notes: 'Use side gate',
    scheduled_start: options.scheduledStart,
    duration_hours: options.durationHours,
  }

  const res = await request.post('/api/v1/bookings', {
    data: payload,
  })
  const parsed = await parseApiResponse<CreatedBooking>(res, testInfo)
  return parsed.data
}
