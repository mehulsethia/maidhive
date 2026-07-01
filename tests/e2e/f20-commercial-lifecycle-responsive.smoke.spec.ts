import { expect, test, type Page, type Route } from '@playwright/test'
import { authStatePath } from './auth-state'
import { hasRoleCredentialCandidates } from './helpers'

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const
const RESPONSIVE_BOOKING_ID = '00000000-0000-4000-8000-000000000020'

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

async function expectClientProvidedSupplies(page: Page) {
  await expect(
    page.getByText('Cleaning supplies: Provided by client', { exact: true }),
  ).toBeVisible()
}

async function mockBookingMessages(page: Page) {
  await page.route(`**/api/v1/messages/${RESPONSIVE_BOOKING_ID}`, (route) => fulfill(route, []))
}

async function installMockStripe(page: Page) {
  await page.addInitScript(() => {
    const element = {
      mount: () => undefined,
      destroy: () => undefined,
      on: () => undefined,
      off: () => undefined,
      update: () => undefined,
      collapse: () => Promise.resolve(),
    }
    ;(window as any).Stripe = () => ({
      registerAppInfo: () => undefined,
      elements: () => ({
        create: () => element,
        update: () => undefined,
      }),
      createToken: async () => ({}),
      createPaymentMethod: async () => ({}),
      confirmCardPayment: async () => ({}),
      confirmPayment: async () => ({}),
    })
  })
}

function bookingFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: RESPONSIVE_BOOKING_ID,
    client_id: 'client-profile',
    cleaner_id: 'cleaner-profile',
    status: 'confirmed',
    service_type: 'standard',
    address: '12 Responsive Street',
    city: 'Larnaca',
    postcode: '6020',
    country: 'CY',
    apartment_details: 'Apartment 4B',
    access_notes: 'Call on arrival',
    scheduled_start: isoHoursFromNow(72),
    scheduled_end: isoHoursFromNow(74),
    duration_hours: 1,
    hourly_rate: 6,
    subtotal: 6,
    platform_fee_pct: 10,
    platform_fee: 2,
    cleaner_payout: 6,
    total_amount: 8,
    special_instructions: [
      'Job type: Regular clean',
      'Cleaning supplies: I will provide cleaning supplies',
      'What needs to be cleaned: Kitchen and bathroom',
    ].join('\n'),
    accepted_at: isoHoursFromNow(-24),
    confirmed_at: isoHoursFromNow(-23),
    created_at: isoHoursFromNow(-48),
    updated_at: isoHoursFromNow(-12),
    cleaner_proposals: 0,
    client_proposals: 0,
    post_cleaner_proposals: 0,
    post_client_proposals: 0,
    client: {
      id: 'client-profile',
      created_at: isoHoursFromNow(-720),
      trust: { member_since: isoHoursFromNow(-720), completed_bookings_count: 2 },
      user: {
        id: 'client-user',
        name: 'Responsive Client',
        email: 'client@example.test',
        role: 'client',
        is_active: true,
        created_at: isoHoursFromNow(-720),
      },
    },
    cleaner: {
      id: 'cleaner-profile',
      profile_image_url: null,
      user: {
        id: 'cleaner-user',
        name: 'Responsive Cleaner',
        email: 'cleaner@example.test',
        role: 'cleaner',
        is_active: true,
        created_at: isoHoursFromNow(-720),
      },
    },
    payment: {
      id: 'payment-responsive',
      status: 'authorized',
      amount: 8,
      platform_fee: 2,
      cleaner_payout: 6,
      currency: 'eur',
      authorized_at: isoHoursFromNow(-22),
      created_at: isoHoursFromNow(-24),
    },
    review: null,
    dispute: null,
    ...overrides,
  }
}

test.describe('F20 commercial and lifecycle responsive regression @smoke', () => {
  test.setTimeout(180_000)

  test.describe('admin session', () => {
    test.use({ storageState: authStatePath('admin') })

    test('E2E-RESP-04 dispute lifecycle and amendment audit stay readable at all viewports', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('admin'), 'Admin E2E credentials are required')

      const createdAt = isoHoursFromNow(-36)
      const proposedAt = isoHoursFromNow(-30)
      const resolvedAt = isoHoursFromNow(-12)
      const releasedAt = isoHoursFromNow(-10)
      const adminBooking = bookingFixture({
        status: 'completed',
        scheduled_start: isoHoursFromNow(-48),
        scheduled_end: isoHoursFromNow(-46),
        started_at: isoHoursFromNow(-48),
        completed_at: isoHoursFromNow(-46),
        payment: {
          id: 'payment-responsive',
          status: 'transferred',
          amount: 8,
          platform_fee: 2,
          cleaner_payout: 6,
          currency: 'eur',
          authorized_at: isoHoursFromNow(-60),
          captured_at: isoHoursFromNow(-45),
          transferred_at: releasedAt,
          created_at: isoHoursFromNow(-62),
        },
        dispute: {
          id: 'dispute-responsive',
          status: 'resolved',
          reason: 'Service outcome requires review',
          reporter_role: 'client',
          resolution_type: 'release_cleaner',
          resolution_note: 'Reviewed and released',
          resolved_at: resolvedAt,
          created_at: createdAt,
        },
        action_events: [
          {
            id: 'event-proposed',
            type: 'amend_start_proposed',
            actor_role: 'cleaner',
            metadata: {
              original_start: isoHoursFromNow(-50),
              proposed_start: isoHoursFromNow(-50.5),
              proposed_by: 'cleaner',
            },
            created_at: proposedAt,
          },
          {
            id: 'event-declined',
            type: 'amend_start_declined',
            actor_role: 'client',
            metadata: {
              original_start: isoHoursFromNow(-50),
              proposed_start: isoHoursFromNow(-50.5),
              proposed_by: 'cleaner',
              original_time_unchanged: true,
            },
            created_at: isoHoursFromNow(-29),
          },
        ],
      })

      await page.route(`**/api/v1/admin/bookings/${RESPONSIVE_BOOKING_ID}`, (route) => fulfill(route, adminBooking))

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        await page.goto(`/admin/bookings/${RESPONSIVE_BOOKING_ID}`, { waitUntil: 'domcontentloaded' })

        const bookingState = page.getByTestId('admin-booking-state')
        await expect(bookingState.getByText('Under Review', { exact: true })).toBeVisible()
        await expect(bookingState.getByText('Dispute Resolved', { exact: true })).toBeVisible()
        await expect(bookingState.getByText('Completed – Released', { exact: true })).toBeVisible()
        await expect(page.getByTestId('admin-payment-state').getByText('Stripe Payment Status')).toBeVisible()
        await expect(page.getByTestId('admin-booking-action-log').getByText('Cleaner proposed Amend Start Time')).toBeVisible()
        await expect(page.getByTestId('admin-booking-action-log').getByText('Client declined Amend Start Time')).toBeVisible()
        await expect(page.getByText('Original booking time remained unchanged.')).toBeVisible()
        await expectClientProvidedSupplies(page)
        await expectNoHorizontalOverflow(page, `admin booking at ${viewport.name}`)
      }
    })

    test('E2E-RESP-10 normal cancellation payment releases stay readable at all viewports', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('admin'), 'Admin E2E credentials are required')

      const cancelledAt = isoHoursFromNow(-48)
      const adminBooking = bookingFixture({
        status: 'cancelled',
        cancelled_by: 'client-user',
        cancelled_at: cancelledAt,
        cancellation_reason: 'Cancelled by client more than 24 hours before scheduled start',
        payment: {
          id: 'payment-responsive',
          status: 'released',
          amount: 8,
          platform_fee: 0,
          cleaner_payout: 0,
          currency: 'eur',
          refund_reason: 'payment_authorisation_released',
          authorized_at: isoHoursFromNow(-72),
          created_at: isoHoursFromNow(-74),
        },
      })

      await page.route(`**/api/v1/admin/bookings/${RESPONSIVE_BOOKING_ID}`, (route) => fulfill(route, adminBooking))

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        await page.goto(`/admin/bookings/${RESPONSIVE_BOOKING_ID}`, { waitUntil: 'domcontentloaded' })

        await expect(page.getByTestId('admin-payment-state').getByText('payment released', { exact: true })).toBeVisible()
        const actionLog = page.getByTestId('admin-booking-action-log')
        await expect(actionLog.getByText('Payment released', { exact: true })).toBeVisible()
        await expect(actionLog.getByText(
          'Client payment authorisation was released because the client cancelled more than 24 hours before the scheduled start.',
          { exact: true },
        )).toBeVisible()
        await expect(page.getByText('No cancellation charge', { exact: true })).toBeVisible()
        await expectClientProvidedSupplies(page)
        await expectNoHorizontalOverflow(page, `admin payment release at ${viewport.name}`)
      }
    })
  })

  test.describe('client session', () => {
    test.use({ storageState: authStatePath('client') })

    test('E2E-RESP-05 minimum-fee disclosure stays visible and expandable at all viewports', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('client'), 'Client E2E credentials are required')

      const clientBooking = bookingFixture()
      await page.route(`**/api/v1/bookings/${RESPONSIVE_BOOKING_ID}`, (route) => fulfill(route, clientBooking))
      await page.route('**/api/v1/auth/me', (route) => fulfill(route, clientBooking.client.user))
      await mockBookingMessages(page)

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        await page.goto(`/client/bookings/${RESPONSIVE_BOOKING_ID}`, { waitUntil: 'domcontentloaded' })

        const notice = page.getByTestId('minimum-platform-fee-notice')
        await expect(notice.getByText('Minimum platform fee of €2.00 applies.', { exact: true })).toBeVisible()
        await notice.locator('summary').click()
        await expect(notice.getByText(/Platform fees are normally 10%/)).toBeVisible()
        await expectClientProvidedSupplies(page)
        await expectNoHorizontalOverflow(page, `client minimum-fee booking at ${viewport.name}`)
      }
    })

    test('E2E-RESP-08 cleaner-cancelled client cards use no-charge wording responsively', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('client'), 'Client E2E credentials are required')

      const cancelledBooking = bookingFixture({
        status: 'cancelled',
        cancelled_by: 'cleaner-user',
        cancelled_at: isoHoursFromNow(-2),
        cancellation_reason: 'Cancelled by cleaner more than 24 hours before scheduled start',
        payment: {
          id: 'payment-responsive',
          status: 'released',
          amount: 8,
          platform_fee: 0,
          cleaner_payout: 0,
          currency: 'eur',
          created_at: isoHoursFromNow(-24),
        },
      })
      await page.route('**/api/v1/bookings?*', (route) => fulfill(route, {
        bookings: [cancelledBooking],
        total: 1,
        page: 1,
        page_size: 20,
        has_next: false,
      }))

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        await page.goto('/client/bookings', { waitUntil: 'domcontentloaded' })
        await expect(page.getByText('Cancelled by cleaner', { exact: true })).toBeVisible()
        await expect(page.getByText('No cancellation charge', { exact: true })).toBeVisible()
        await expectNoHorizontalOverflow(page, `client cancelled card at ${viewport.name}`)
      }
    })

    test('E2E-RESP-11 early cancellation notification wraps cleanly at all viewports', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('client'), 'Client E2E credentials are required')

      const notificationBody = 'You cancelled your booking for 3 Jul 2026 at 10:00. No cancellation charge applies.'
      await page.route('**/api/v1/notifications?*', (route) => fulfill(route, {
        notifications: [{
          id: 'notification-responsive',
          user_id: 'client-user',
          type: 'booking_cancelled',
          title: 'Booking cancelled',
          body: notificationBody,
          data: { booking_id: RESPONSIVE_BOOKING_ID },
          is_read: false,
          created_at: isoHoursFromNow(-1),
        }],
        total: 1,
        page: 1,
        page_size: 250,
      }))
      await page.route('**/api/v1/auth/me', (route) => fulfill(route, bookingFixture().client.user))

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        await page.goto('/client/notifications', { waitUntil: 'domcontentloaded' })
        await expect(page.getByText(notificationBody, { exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Mark read' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible()
        await expectNoHorizontalOverflow(page, `client cancellation notification at ${viewport.name}`)
      }
    })

    test('E2E-RESP-09 checkout minimum-fee summary remains responsive', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('client'), 'Client E2E credentials are required')

      const clientBooking = bookingFixture({ status: 'draft', accepted_at: null, confirmed_at: null })
      await installMockStripe(page)
      await page.route(`**/api/v1/bookings/${RESPONSIVE_BOOKING_ID}`, (route) => fulfill(route, clientBooking))
      await page.route('**/api/v1/payments/intent', (route) => fulfill(route, {
        payment_intent_id: 'pi_responsive',
        client_secret: 'pi_responsive_secret_responsive',
        amount: 8,
        currency: 'eur',
      }))
      await page.route('**/api/v1/payments/methods', (route) => fulfill(route, []))

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        await page.goto(`/client/checkout/${RESPONSIVE_BOOKING_ID}`, { waitUntil: 'domcontentloaded' })
        await page.getByRole('button', { name: 'View price breakdown' }).click()
        const notice = page.getByTestId('minimum-platform-fee-notice')
        await expect(notice.getByText('Minimum platform fee of €2.00 applies.', { exact: true })).toBeVisible()
        await expectNoHorizontalOverflow(page, `client checkout at ${viewport.name}`)
      }
    })
  })

  test.describe('cleaner session', () => {
    test.use({ storageState: authStatePath('cleaner') })

    test('E2E-RESP-06 cleaner cancellation modal handles early and late copy responsively', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('cleaner'), 'Cleaner E2E credentials are required')

      let cleanerBooking = bookingFixture()
      await page.route(`**/api/v1/bookings/${RESPONSIVE_BOOKING_ID}`, (route) => fulfill(route, cleanerBooking))
      await page.route('**/api/v1/auth/me', (route) => fulfill(route, cleanerBooking.cleaner.user))
      await mockBookingMessages(page)
      await page.route('**/api/v1/cleaners/me', (route) => fulfill(route, {
        cleaner: { id: 'cleaner-profile', stripe_onboarding_complete: true },
        onboarding: {},
      }))

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        await page.goto(`/cleaner/bookings/${RESPONSIVE_BOOKING_ID}`, { waitUntil: 'domcontentloaded' })
        await page.getByRole('button', { name: 'Cancel booking', exact: true }).click()

        const dialog = page.getByTestId('cleaner-cancellation-confirmation')
        await expect(dialog.getByText('The client will receive a full refund.')).toBeVisible()
        await expect(dialog.getByText('You will not receive any payout for this booking.')).toBeVisible()
        await expect(dialog.getByRole('button', { name: 'Keep booking' })).toBeVisible()
        await expectClientProvidedSupplies(page)
        await expectNoHorizontalOverflow(page, `early cleaner cancellation modal at ${viewport.name}`)
        await dialog.getByRole('button', { name: 'Keep booking' }).click()
      }

      cleanerBooking = bookingFixture({
        scheduled_start: isoHoursFromNow(12),
        scheduled_end: isoHoursFromNow(14),
      })
      await page.setViewportSize(VIEWPORTS[0])
      await page.goto(`/cleaner/bookings/${RESPONSIVE_BOOKING_ID}`, { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: 'Cancel booking', exact: true }).click()
      const lateDialog = page.getByTestId('cleaner-cancellation-confirmation')
      await expect(lateDialog.getByText(/compensation in accordance with MaidHive’s cancellation policy/)).toBeVisible()
      await expect(lateDialog.getByText(/Super Cleaner eligibility/)).toBeVisible()
      await expectNoHorizontalOverflow(page, 'late cleaner cancellation modal at mobile')
    })

    test('E2E-RESP-07 cleaner cancelled cards show cancellation source without overflow', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('cleaner'), 'Cleaner E2E credentials are required')

      const cancelledBooking = bookingFixture({
        status: 'cancelled',
        cancelled_by: 'cleaner-user',
        cancelled_at: isoHoursFromNow(-2),
        cancellation_reason: 'Cancelled by cleaner more than 24 hours before scheduled start',
        payment: {
          id: 'payment-responsive',
          status: 'released',
          amount: 8,
          platform_fee: 0,
          cleaner_payout: 0,
          currency: 'eur',
          created_at: isoHoursFromNow(-24),
        },
      })
      await page.route('**/api/v1/bookings?*', (route) => fulfill(route, {
        bookings: [cancelledBooking],
        total: 1,
        page: 1,
        page_size: 20,
        has_next: false,
      }))
      await page.route('**/api/v1/cleaners/me', (route) => fulfill(route, {
        cleaner: { id: 'cleaner-profile', stripe_onboarding_complete: true },
        onboarding: {},
      }))

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        await page.goto('/cleaner/bookings', { waitUntil: 'domcontentloaded' })
        await expect(page.getByTestId('cleaner-cancellation-source').getByText('Cancelled by you')).toBeVisible()
        await expect(page.getByText('No cancellation charge', { exact: true })).toBeVisible()
        await expect(page.getByText('No cleaner compensation')).toBeVisible()
        await expectClientProvidedSupplies(page)
        await expectNoHorizontalOverflow(page, `cleaner cancelled card at ${viewport.name}`)
      }
    })

    test('E2E-RESP-12 cleaner dashboard supplies responsibility stays explicit at all viewports', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('cleaner'), 'Cleaner E2E credentials are required')

      const pendingBooking = bookingFixture({ status: 'pending', confirmed_at: null })
      await page.route('**/api/v1/bookings?*', (route) => fulfill(route, {
        bookings: [pendingBooking],
        total: 1,
        page: 1,
        page_size: 50,
        has_next: false,
      }))
      await page.route('**/api/v1/cleaners/me', (route) => fulfill(route, {
        cleaner: {
          id: 'cleaner-profile',
          status: 'approved',
          lifecycle_status: 'live',
          stripe_onboarding_complete: true,
          profile_complete: true,
        },
        onboarding: { completion_pct: 100, steps: {} },
      }))

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)
        await page.goto('/cleaner/dashboard', { waitUntil: 'domcontentloaded' })
        await expectClientProvidedSupplies(page)
        await expectNoHorizontalOverflow(page, `cleaner dashboard supplies at ${viewport.name}`)
      }
    })
  })
})
