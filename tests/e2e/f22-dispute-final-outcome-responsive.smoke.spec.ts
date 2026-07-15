import { expect, test, type Page, type Route } from '@playwright/test'
import { authStatePath } from './auth-state'

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const

const BOOKING_ID = '00000000-0000-4000-8000-000000000022'
const DISPUTE_ID = '00000000-0000-4000-8000-0000000000d2'
const CLIENT_ID = 'client-final-outcome'
const CLEANER_ID = 'cleaner-final-outcome'
const CLIENT_USER_ID = 'client-user-final-outcome'
const CLEANER_USER_ID = 'cleaner-user-final-outcome'

function isoHoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

async function fulfill(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  })
}

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }))
  expect(dimensions.document, `${context} should not overflow horizontally`)
    .toBeLessThanOrEqual(dimensions.viewport + 1)
}

function base64Url(value: unknown) {
  return Buffer
    .from(typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64url')
}

async function installSupabaseSession(page: Page, role: 'admin' | 'client' | 'cleaner') {
  const now = Math.floor(Date.now() / 1000)
  const userId = role === 'admin'
    ? 'admin-final-outcome'
    : role === 'client'
      ? CLIENT_USER_ID
      : CLEANER_USER_ID
  const email = `${role}@example.test`
  const jwt = [
    base64Url({ alg: 'HS256', typ: 'JWT' }),
    base64Url({
      aud: 'authenticated',
      exp: now + 3600,
      iat: now,
      iss: 'https://phbbzgszfbnvvksklzss.supabase.co/auth/v1',
      sub: userId,
      email,
      role: 'authenticated',
      user_metadata: { role },
    }),
    'test-signature',
  ].join('.')
  const session = {
    access_token: jwt,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: `refresh-${role}`,
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { role },
      created_at: isoHoursFromNow(-720),
      updated_at: isoHoursFromNow(-1),
      is_anonymous: false,
    },
  }
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`
  const chunkSize = 3000
  const chunks = value.match(new RegExp(`.{1,${chunkSize}}`, 'g')) ?? []
  await page.context().clearCookies()
  await page.context().addCookies(chunks.map((value, index) => ({
    name: `sb-phbbzgszfbnvvksklzss-auth-token.${index}`,
    value,
    domain: 'localhost',
    path: '/',
    expires: now + 3600,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  })))
}

function makeBooking(disputeStatus: 'under_review' | 'resolved') {
  const resolved = disputeStatus === 'resolved'
  return {
    id: BOOKING_ID,
    client_id: CLIENT_ID,
    cleaner_id: CLEANER_ID,
    status: 'completed',
    service_type: 'standard',
    address: '22 Outcome Lane',
    city: 'Larnaca',
    postcode: '6020',
    country: 'CY',
    apartment_details: 'Apartment 2A',
    access_notes: 'Use the side entrance',
    scheduled_start: isoHoursFromNow(-48),
    scheduled_end: isoHoursFromNow(-46),
    started_at: isoHoursFromNow(-48),
    completed_at: isoHoursFromNow(-46),
    duration_hours: 1.25,
    hourly_rate: 16,
    subtotal: 20,
    platform_fee_pct: 10,
    platform_fee: 2,
    cleaner_payout: 20,
    total_amount: 22,
    special_instructions: 'Financial outcome responsive regression booking',
    accepted_at: isoHoursFromNow(-72),
    confirmed_at: isoHoursFromNow(-71),
    created_at: isoHoursFromNow(-96),
    updated_at: isoHoursFromNow(-2),
    cleaner_proposals: 0,
    client_proposals: 0,
    post_cleaner_proposals: 0,
    post_client_proposals: 0,
    payment: {
      id: 'payment-final-outcome',
      status: resolved ? 'refunded' : 'captured',
      amount: 22,
      currency: 'eur',
      platform_fee: 2,
      cleaner_payout: resolved ? 0 : 20,
      refund_amount: resolved ? 22 : 0,
      authorized_at: isoHoursFromNow(-72),
      captured_at: isoHoursFromNow(-46),
      refunded_at: resolved ? isoHoursFromNow(-2) : null,
      payout_scheduled_at: isoHoursFromNow(-22),
      transferred_at: null,
      stripe_transfer_id: null,
      created_at: isoHoursFromNow(-73),
    },
    review: null,
    dispute: {
      id: DISPUTE_ID,
      booking_id: BOOKING_ID,
      status: disputeStatus,
      reason: 'Service issue',
      explanation: 'Client requested a review of the payment outcome.',
      issue_type: 'service_issue',
      reporter_role: 'client',
      resolution_type: resolved ? 'full_refund' : null,
      refund_amount: resolved ? 22 : null,
      resolution_note: resolved ? 'Full refund issued after dispute review.' : null,
      created_at: isoHoursFromNow(-24),
      resolved_at: resolved ? isoHoursFromNow(-2) : null,
    },
    action_events: resolved ? [
      {
        id: 'event-payout-paused',
        type: 'cleaner_payout_paused',
        actor_role: 'system',
        metadata: { amount: 20, transfer_status: 'not_transferred' },
        created_at: isoHoursFromNow(-24),
      },
      {
        id: 'event-payout-adjusted',
        type: 'cleaner_payout_adjusted',
        actor_role: 'system',
        metadata: { from_amount: 20, to_amount: 0 },
        created_at: isoHoursFromNow(-2),
      },
      {
        id: 'event-refunded',
        type: 'payment_refunded',
        actor_role: 'system',
        metadata: { amount: 22 },
        created_at: isoHoursFromNow(-2),
      },
      {
        id: 'event-dispute-resolved',
        type: 'dispute_resolved',
        actor_role: 'admin',
        metadata: { resolution_type: 'full_refund' },
        created_at: isoHoursFromNow(-2),
      },
    ] : [
      {
        id: 'event-active-payout-paused',
        type: 'cleaner_payout_paused',
        actor_role: 'system',
        metadata: { amount: 20, transfer_status: 'not_transferred' },
        created_at: isoHoursFromNow(-24),
      },
    ],
    client: {
      id: CLIENT_ID,
      user: {
        id: CLIENT_USER_ID,
        name: 'Responsive Client',
        email: 'client@example.test',
        role: 'client',
        is_active: true,
        created_at: isoHoursFromNow(-720),
      },
    },
    cleaner: {
      id: CLEANER_ID,
      hourly_rate: 16,
      profile_image_url: null,
      user: {
        id: CLEANER_USER_ID,
        name: 'Responsive Cleaner',
        email: 'cleaner@example.test',
        role: 'cleaner',
        is_active: true,
        created_at: isoHoursFromNow(-720),
      },
    },
  }
}

function paginated(items: unknown[]) {
  return { items, bookings: items, disputes: items, total: items.length, page: 1, page_size: 50 }
}

async function mockCommonApis(page: Page, role: 'admin' | 'client' | 'cleaner') {
  const resolvedBooking = makeBooking('resolved')
  const activeBooking = makeBooking('under_review')
  const activeDispute = activeBooking.dispute

  await page.route(`**/api/v1/admin/bookings/${BOOKING_ID}`, (route) => fulfill(route, resolvedBooking))
  await page.route('**/api/v1/admin/bookings?**', (route) => fulfill(route, paginated([resolvedBooking])))
  await page.route(`**/api/v1/bookings/${BOOKING_ID}`, (route) => fulfill(route, resolvedBooking))
  await page.route('**/api/v1/bookings?**', (route) => fulfill(route, paginated([resolvedBooking])))
  await page.route('**/api/v1/disputes?**', (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('status') === 'resolved') return fulfill(route, paginated([]))
    return fulfill(route, paginated([{ ...activeDispute, booking: activeBooking }]))
  })
  await page.route(`**/api/v1/messages/${BOOKING_ID}`, (route) => fulfill(route, []))
  await page.route('**/api/v1/messages?**', (route) => fulfill(route, []))
  await page.route('**/api/v1/notifications**', (route) => fulfill(route, paginated([])))
  await page.route('**/api/v1/auth/me', (route) => fulfill(route, {
    id: role === 'client' ? CLIENT_USER_ID : role === 'cleaner' ? CLEANER_USER_ID : 'admin-final-outcome',
    name: role === 'client' ? 'Responsive Client' : role === 'cleaner' ? 'Responsive Cleaner' : 'Responsive Admin',
    email: `${role}@example.test`,
    role,
    is_active: true,
  }))
  await page.route('**/api/v1/cleaners/me', (route) => fulfill(route, {
    cleaner: {
      id: CLEANER_ID,
      user_id: CLEANER_USER_ID,
      hourly_rate: 16,
      status: 'approved',
      profile_complete: true,
      stripe_onboarding_complete: true,
      profile_image_url: null,
      availability: [],
      service_areas: [],
      user: {
        id: CLEANER_USER_ID,
        name: 'Responsive Cleaner',
        email: 'cleaner@example.test',
        role: 'cleaner',
        is_active: true,
      },
    },
    onboarding: {
      can_submit: false,
      completion_percent: 100,
      missing_steps: [],
      steps: [],
    },
  }))
}

async function openResponsive(page: Page, path: string, context: string) {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/)
    await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)
    await expect(page.locator('body')).not.toBeEmpty()
    await expectNoHorizontalOverflow(page, `${context} at ${viewport.name}`)
  }
}

test.describe('F22 full-refund final-outcome responsive regression @smoke', () => {
  test.setTimeout(180_000)

  test.describe('admin session', () => {
    test.use({ storageState: authStatePath('admin') })

    test('E2E-RESP-16 admin final payment outcome and resolution preview stay responsive', async ({ page }) => {
      await installSupabaseSession(page, 'admin')
      await mockCommonApis(page, 'admin')

      await openResponsive(page, `/admin/bookings/${BOOKING_ID}`, 'admin booking detail')
      await expect(page.getByTestId('admin-payment-state').getByText('Cleaner payout', { exact: true })).toBeVisible()
      await expect(page.getByTestId('admin-payment-state').getByText('Not transferred')).toBeVisible()
      await expect(page.getByText('Original platform fee')).toBeVisible()
      await expect(page.getByText('Final MaidHive retained fee')).toBeVisible()
      await expect(page.getByText('Fully refunded')).toBeVisible()
      await expect(page.getByText('Final client amount paid')).toBeVisible()
      await expect(page.getByText('Cleaner payout paused due to dispute')).toBeVisible()
      await expect(page.getByText('Cleaner payout adjusted from €20.00 to €0.00')).toBeVisible()

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        await page.goto('/admin/disputes', { waitUntil: 'domcontentloaded' })
        await expect(page).not.toHaveURL(/\/login(?:\?|$)/)
        await page.getByRole('button', { name: /^Resolve$/ }).first().click()
        const dialog = page.getByRole('dialog')
        await dialog.locator('select').first().selectOption('full_refund')
        await expect(dialog.getByText('Final financial outcome')).toBeVisible()
        await expect(dialog.getByText('Original client payment')).toBeVisible()
        await expect(dialog.getByText('Refund to client', { exact: true })).toBeVisible()
        await expect(dialog.getByText('Client final amount paid')).toBeVisible()
        await expect(dialog.getByText('Cleaner final payout')).toBeVisible()
        await expect(dialog.getByText('MaidHive retained')).toBeVisible()
        await expect(dialog.getByText('€22.00')).toHaveCount(2)
        await expect(dialog.getByText('€0.00').first()).toBeVisible()
        await expect(dialog.getByRole('button', { name: /Confirm resolution/ })).toBeEnabled()
        await expectNoHorizontalOverflow(page, `admin resolution dialog at ${viewport.name}`)
      }
    })
  })

  test.describe('cleaner session', () => {
    test.use({ storageState: authStatePath('cleaner') })

    test('E2E-RESP-17 cleaner no-payout outcome stays responsive everywhere', async ({ page }) => {
      await mockCommonApis(page, 'cleaner')

      await openResponsive(page, '/cleaner/dashboard', 'cleaner dashboard')
      await expect(page.getByText('Completed · No payout')).toBeVisible()
      await expect(page.getByText('Final payout: €0.00')).toBeVisible()

      await openResponsive(page, '/cleaner/bookings', 'cleaner bookings list')
      await expect(page.getByText('Completed · No payout')).toBeVisible()
      await expect(page.getByText('Final payout: €0.00')).toBeVisible()

      await openResponsive(page, `/cleaner/bookings/${BOOKING_ID}`, 'cleaner booking detail')
      await expect(page.getByText('Completed · No payout')).toBeVisible()
      await expect(page.getByText('Final payout')).toBeVisible()
      await expect(page.getByText('Original cleaner payout: €20.00')).toBeVisible()
      await expect(page.getByText('Dispute adjustment: -€20.00')).toBeVisible()
      await expect(page.getByText('Final cleaner payout: €0.00')).toBeVisible()
      await expect(page.getByText('No payout is due for this booking after the resolved dispute.')).toBeVisible()
      await expect(page.getByText(/Released after the .* report window from scheduled completion/)).toHaveCount(0)

      await openResponsive(page, '/cleaner/profile?tab=payments', 'cleaner payment history')
      await expect(page.getByText('Payment History')).toBeVisible()
      await expect(page.getByText('€0.00')).toBeVisible()
      await expect(page.getByText('No payout')).toBeVisible()
      await expect(page.getByText('Awaiting release')).toHaveCount(0)
    })
  })

  test.describe('client session', () => {
    test.use({ storageState: authStatePath('client') })

    test('E2E-RESP-18 client full-refund labels stay responsive everywhere', async ({ page }) => {
      await mockCommonApis(page, 'client')

      await openResponsive(page, '/client/dashboard', 'client dashboard')
      await expect(page.getByText('Completed · Refunded €22.00')).toBeVisible()

      await openResponsive(page, '/client/bookings', 'client bookings list')
      await expect(page.getByText('Refunded').first()).toBeVisible()
      await expect(page.getByText('Paid €0.00')).toBeVisible()
      await expect(page.getByText('Refunded €22.00')).toBeVisible()
      await expect(page.getByText('Original €22.00')).toBeVisible()

      await openResponsive(page, `/client/bookings/${BOOKING_ID}`, 'client booking detail')
      await expect(page.getByText('Financial status: Refunded')).toBeVisible()
      await expect(page.getByText('Original total')).toBeVisible()
      await expect(page.getByText('Full refund')).toBeVisible()
      await expect(page.getByText('Final amount paid', { exact: true })).toBeVisible()
      await expect(page.getByText('Partial refund')).toHaveCount(0)
    })
  })
})
