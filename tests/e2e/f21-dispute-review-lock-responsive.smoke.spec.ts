import { expect, test, type Page, type Route } from '@playwright/test'
import { authStatePath } from './auth-state'

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const

const BOOKING_ID = '00000000-0000-4000-8000-000000000021'
const CLEANER_ID = 'cleaner-responsive'
const CLIENT_ID = 'client-responsive'
const CLIENT_USER_ID = 'client-user-responsive'
const CLEANER_USER_ID = 'cleaner-user-responsive'

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

function activeDisputeBooking() {
  return {
    id: BOOKING_ID,
    client_id: CLIENT_ID,
    cleaner_id: CLEANER_ID,
    status: 'completed',
    service_type: 'standard',
    address: '12 Responsive Street',
    city: 'Larnaca',
    postcode: '6020',
    country: 'CY',
    apartment_details: 'Apartment 4B',
    access_notes: 'Call on arrival',
    scheduled_start: isoHoursFromNow(-4),
    scheduled_end: isoHoursFromNow(-2),
    started_at: isoHoursFromNow(-4),
    completed_at: isoHoursFromNow(-2),
    duration_hours: 2,
    hourly_rate: 16,
    subtotal: 32,
    platform_fee_pct: 10,
    platform_fee: 3.2,
    cleaner_payout: 32,
    total_amount: 35.2,
    special_instructions: 'Cleaning supplies: Provided by client',
    accepted_at: isoHoursFromNow(-28),
    confirmed_at: isoHoursFromNow(-27),
    created_at: isoHoursFromNow(-48),
    updated_at: isoHoursFromNow(-1),
    cleaner_proposals: 0,
    client_proposals: 0,
    post_cleaner_proposals: 0,
    post_client_proposals: 0,
    payment: {
      id: 'payment-responsive-review-lock',
      status: 'captured',
      amount: 35.2,
      platform_fee: 3.2,
      cleaner_payout: 32,
      currency: 'eur',
      authorized_at: isoHoursFromNow(-28),
      captured_at: isoHoursFromNow(-2),
      transferred_at: null,
      created_at: isoHoursFromNow(-29),
    },
    review: null,
    dispute: {
      id: 'dispute-responsive-review-lock',
      booking_id: BOOKING_ID,
      status: 'under_review',
      reason: 'Service issue',
      issue_type: 'service_issue',
      reporter_role: 'client',
      created_at: isoHoursFromNow(-1),
    },
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

async function mockSharedApis(page: Page, role: 'client' | 'cleaner') {
  const booking = activeDisputeBooking()
  await page.route(`**/api/v1/bookings/${BOOKING_ID}`, (route) => fulfill(route, booking))
  await page.route(`**/api/v1/messages/${BOOKING_ID}`, (route) => fulfill(route, []))
  await page.route('**/api/v1/bookings?**', (route) => fulfill(route, {
    items: [booking],
    bookings: [booking],
    total: 1,
    page: 1,
    page_size: 50,
  }))
  await page.route('**/api/v1/disputes?**', (route) => fulfill(route, {
    items: [booking.dispute],
    disputes: [booking.dispute],
    total: 1,
    page: 1,
    page_size: 20,
  }))
  await page.route('**/api/v1/auth/me', (route) => fulfill(route, {
    id: role === 'client' ? CLIENT_USER_ID : CLEANER_USER_ID,
    name: role === 'client' ? 'Responsive Client' : 'Responsive Cleaner',
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

async function assertRouteResponsive(page: Page, path: string, context: string) {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/)
    await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)
    await expect(page.locator('body')).not.toBeEmpty()
    await expectNoHorizontalOverflow(page, `${context} at ${viewport.name}`)
  }
}

test.describe('F21 dispute review-lock responsive regression @smoke', () => {
  test.setTimeout(120_000)

  test.describe('client session', () => {
    test.use({ storageState: authStatePath('client') })

    test('E2E-RESP-14 active dispute status and review lock stay responsive', async ({ page }) => {
      await mockSharedApis(page, 'client')

      await assertRouteResponsive(page, '/client/bookings', 'client bookings list')
      await expect(page.getByText('This booking is currently under review.')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Leave a review' })).toHaveCount(0)

      await assertRouteResponsive(page, `/client/bookings/${BOOKING_ID}`, 'client booking detail')
      await expect(page.getByText('This booking is now Under Review, and the cleaner payout has been paused until the case is resolved.')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Leave a review' })).toHaveCount(0)
    })
  })

  test.describe('cleaner session', () => {
    test.use({ storageState: authStatePath('cleaner') })

    test('E2E-RESP-15 cleaner payout-paused displays stay responsive', async ({ page }) => {
      await mockSharedApis(page, 'cleaner')

      await assertRouteResponsive(page, '/cleaner/dashboard', 'cleaner dashboard')
      await expect(page.getByText(/Payout pending review\s+EUR32\.00|Payout pending review\s+€32\.00/)).toBeVisible()

      await assertRouteResponsive(page, `/cleaner/bookings/${BOOKING_ID}`, 'cleaner booking detail')
      await expect(page.getByText('Payout is paused until MaidHive resolves this dispute.')).toBeVisible()
      await expect(page.getByText('This booking is currently under review.')).toBeVisible()
    })
  })
})
