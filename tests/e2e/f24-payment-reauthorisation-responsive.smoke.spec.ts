import { expect, test, type Page, type Route } from '@playwright/test'

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const

const BOOKING_ID = '00000000-0000-4000-8000-000000000024'
const e2eAuthBypassEnabled =
  process.env.MAIDHIVE_E2E_AUTH_BYPASS === '1' ||
  process.env.NEXT_PUBLIC_MAIDHIVE_E2E_AUTH_BYPASS === '1'

async function seedAdminBypass(page: Page) {
  await page.addInitScript(
    () => {
      window.localStorage.setItem('maidhive:e2e-admin-session', '1')
    },
  )
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

async function expectNoNextOverlay(page: Page) {
  await expect(page.getByText('Unhandled Runtime Error')).toHaveCount(0)
  await expect(page.getByText('Build Error')).toHaveCount(0)
  await expect(page.getByText('Runtime Error')).toHaveCount(0)
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

function isoHoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function bookingFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    client_id: 'client-profile',
    cleaner_id: 'cleaner-profile',
    status: 'accepted',
    service_type: 'standard',
    address: '12 Reauth Street',
    city: 'Larnaca',
    postcode: '6020',
    country: 'CY',
    apartment_details: 'Apartment 4B',
    access_notes: 'Call on arrival',
    scheduled_start: isoHoursFromNow(72),
    scheduled_end: isoHoursFromNow(74),
    duration_hours: 2,
    hourly_rate: 10,
    subtotal: 20,
    platform_fee_pct: 10,
    platform_fee: 2,
    cleaner_payout: 20,
    total_amount: 22,
    special_instructions: 'Job type: Regular clean\nCleaning supplies: I will provide cleaning supplies',
    accepted_at: '2026-08-10T13:25:00.000Z',
    confirmed_at: '2026-08-10T13:25:00.000Z',
    pay_by: '2026-08-12T08:00:00.000Z',
    reauthorization_required: true,
    reauthorization_grace_expires_at: '2026-08-12T08:00:00.000Z',
    created_at: isoHoursFromNow(-72),
    updated_at: isoHoursFromNow(-2),
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
      hourly_rate: 10,
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
      id: 'payment-reauth',
      status: 'released',
      amount: 22,
      platform_fee: 2,
      cleaner_payout: 20,
      currency: 'eur',
      refund_reason: 'payment_authorisation_released',
      authorized_at: isoHoursFromNow(-48),
      created_at: isoHoursFromNow(-50),
    },
    review: null,
    dispute: null,
    action_events: [
      {
        id: 'event-release',
        type: 'payment_authorisation_released',
        actor_role: 'system',
        metadata: {
          amount: 22,
          payment_state_before: 'authorized',
          payment_state_after: 'released',
          reason: 'payment_reauthorisation_required_after_reschedule',
        },
        created_at: isoHoursFromNow(-4),
      },
      {
        id: 'event-required',
        type: 'payment_reauthorisation_required',
        actor_role: 'system',
        metadata: {
          deadline: '2026-08-12T08:00:00.000Z',
          previous_confirmed_at: '2026-08-10T13:25:00.000Z',
        },
        created_at: isoHoursFromNow(-4),
      },
    ],
    ...overrides,
  }
}

async function mockSharedShell(page: Page, role: 'admin' | 'client' | 'cleaner') {
  await page.route('**/api/v1/auth/me', (route) => fulfill(route, {
    id: `${role}-user`,
    name: `${role} user`,
    email: `${role}@example.test`,
    role,
  }))
  await page.route('**/api/v1/counts', (route) => fulfill(route, {
    unread_chats: 0,
    pending_bookings: 0,
    unread_notifications: 0,
  }))
}

async function mockCleanerProfile(page: Page) {
  await page.route('**/api/v1/cleaners/me', (route) => fulfill(route, {
    cleaner: {
      id: 'cleaner-profile',
      user_id: 'cleaner-user',
      status: 'approved',
      lifecycle_status: 'approved',
      stripe_account_id: 'acct_test',
      stripe_onboarding_complete: true,
      stripe_charges_enabled: true,
      stripe_payouts_enabled: true,
      hourly_rate: 10,
      user: { id: 'cleaner-user', name: 'Responsive Cleaner', role: 'cleaner' },
    },
    onboarding: { complete: true, steps: [] },
  }))
  await page.route('**/api/v1/cleaners/stats', (route) => fulfill(route, {
    total_earnings: 0,
    completed_jobs: 0,
    average_rating: null,
    pending_bookings: 0,
  }))
}

test.describe('F24 payment re-authorisation responsive regression @smoke', () => {
  test.setTimeout(180_000)

  test('client re-authorisation checkout and notifications stay responsive', async ({ page }) => {
    test.skip(!e2eAuthBypassEnabled, 'Set MAIDHIVE_E2E_AUTH_BYPASS=1 for routed responsive auth bypass')

    await installMockStripe(page)
    const booking = bookingFixture()
    const notifications = [
      {
        id: 'notification-required',
        type: 'booking_payment_required',
        title: 'Card re-authorisation required',
        body: 'Please re-authorise your card by 12 Aug 2026 at 11:00 to keep the rescheduled booking active.',
        data: { booking_id: BOOKING_ID },
        is_read: false,
        created_at: isoHoursFromNow(-3),
      },
      {
        id: 'notification-complete',
        type: 'booking_payment_reauthorisation_complete',
        title: 'Payment re-authorisation complete',
        body: 'Your payment re-authorisation has been completed successfully. Your booking remains confirmed.',
        data: { booking_id: BOOKING_ID },
        is_read: false,
        created_at: isoHoursFromNow(-1),
      },
    ]

    await mockSharedShell(page, 'client')
    await page.route(`**/api/v1/bookings/${BOOKING_ID}`, (route) => fulfill(route, booking))
    await page.route('**/api/v1/payments/intent', (route) => fulfill(route, {
      payment_intent_id: 'pi_responsive_reauth',
      client_secret: 'pi_responsive_reauth_secret',
      amount: 22,
      currency: 'eur',
    }))
    await page.route('**/api/v1/payments/methods', (route) => fulfill(route, [
      { id: 'pm_saved', brand: 'visa', last4: '4242', exp_month: 9, exp_year: 2029 },
    ]))
    await page.route('**/api/v1/notifications**', (route) => fulfill(route, {
      notifications,
      total: notifications.length,
      page: 1,
      page_size: 250,
    }))

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.goto(`/client/checkout/${BOOKING_ID}`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByText(/^Payment re-authorisation required/)).toBeVisible()
      await expect(page.getByText(/Please re-authorise your card by/)).toBeVisible()
      await expect(page.getByText(/Your booking has already been accepted by the cleaner\. This is a renewal of your payment authorisation only\./)).toBeVisible()
      await expect(page.getByText('This booking request must be responded to by the cleaner')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Authorise €22.00' })).toBeVisible()
      await expectNoNextOverlay(page)
      await expectNoHorizontalOverflow(page, `client re-authorisation checkout at ${viewport.name}`)

      await page.goto('/client/notifications', { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('Card re-authorisation required', { exact: true })).toBeVisible()
      await expect(page.getByText('Payment re-authorisation complete', { exact: true })).toBeVisible()
      await expect(page.getByText('Your payment re-authorisation has been completed successfully. Your booking remains confirmed.', { exact: true })).toBeVisible()
      const relatedLinks = page.getByRole('link', { name: 'Open related item' })
      await expect(relatedLinks.first()).toHaveAttribute('href', `/client/bookings/${BOOKING_ID}`)
      await expectNoNextOverlay(page)
      await expectNoHorizontalOverflow(page, `client re-authorisation notifications at ${viewport.name}`)
    }
  })

  test('cleaner re-authorisation payment state stays responsive without cleaner action', async ({ page }) => {
    test.skip(!e2eAuthBypassEnabled, 'Set MAIDHIVE_E2E_AUTH_BYPASS=1 for routed responsive auth bypass')

    const booking = bookingFixture()

    await mockSharedShell(page, 'cleaner')
    await mockCleanerProfile(page)
    await page.route(`**/api/v1/bookings/${BOOKING_ID}`, (route) => fulfill(route, booking))
    await page.route('**/api/v1/bookings?**', (route) => fulfill(route, {
      bookings: [booking],
      items: [booking],
      total: 1,
      page: 1,
      page_size: 50,
      has_next: false,
    }))
    await page.route('**/api/v1/notifications**', (route) => fulfill(route, {
      notifications: [],
      total: 0,
      page: 1,
      page_size: 250,
    }))

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.goto(`/cleaner/bookings/${BOOKING_ID}`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('Payment re-authorisation pending - awaiting client. You do not need to take any payment action.', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: /Authorise/i })).toHaveCount(0)
      await expectNoNextOverlay(page)
      await expectNoHorizontalOverflow(page, `cleaner re-authorisation booking detail at ${viewport.name}`)

      await page.goto('/cleaner/bookings', { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('Payment re-authorisation pending - awaiting client.', { exact: true })).toBeVisible()
      await expectNoNextOverlay(page)
      await expectNoHorizontalOverflow(page, `cleaner re-authorisation bookings list at ${viewport.name}`)

      await page.goto('/cleaner/dashboard', { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('Payment re-authorisation pending - awaiting client.', { exact: true })).toBeVisible()
      await expectNoNextOverlay(page)
      await expectNoHorizontalOverflow(page, `cleaner re-authorisation dashboard at ${viewport.name}`)
    }
  })

  test('cleaner unresolved re-authorisation cancellation state stays responsive without pending actions', async ({ page }) => {
    test.skip(!e2eAuthBypassEnabled, 'Set MAIDHIVE_E2E_AUTH_BYPASS=1 for routed responsive auth bypass')

    const booking = bookingFixture({
      status: 'cancelled',
      pay_by: null,
      reauthorization_required: false,
      reauthorization_grace_expires_at: null,
      cancelled_at: isoHoursFromNow(-1),
      cancelled_by: null,
      cancellation_reason: 'Payment re-authorisation was not completed by the deadline after reschedule. No penalties applied.',
      payment: {
        id: 'payment-reauth',
        status: 'released',
        amount: 22,
        platform_fee: 2,
        cleaner_payout: 0,
        currency: 'eur',
        refund_reason: 'payment_authorisation_released',
        authorized_at: isoHoursFromNow(-48),
        released_at: isoHoursFromNow(-1),
        created_at: isoHoursFromNow(-50),
      },
    })

    await mockSharedShell(page, 'cleaner')
    await mockCleanerProfile(page)
    await page.route(`**/api/v1/bookings/${BOOKING_ID}`, (route) => fulfill(route, booking))
    await page.route('**/api/v1/bookings?**', (route) => fulfill(route, {
      bookings: [booking],
      items: [booking],
      total: 1,
      page: 1,
      page_size: 50,
      has_next: false,
    }))
    await page.route('**/api/v1/notifications**', (route) => fulfill(route, {
      notifications: [],
      total: 0,
      page: 1,
      page_size: 250,
    }))

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.goto(`/cleaner/bookings/${BOOKING_ID}`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible()
      await expect(page.getByText('Phone access is now closed for this booking.', { exact: true })).toBeVisible()
      await expect(page.getByText('No payout is due because payment re-authorisation was not completed by the deadline.', { exact: true })).toBeVisible()
      await expect(page.getByText('No cleaner compensation', { exact: true }).first()).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Next actions' })).toHaveCount(0)
      await expect(page.getByText(/Payment re-authorisation pending - awaiting client/)).toHaveCount(0)
      await expect(page.getByText(/Report issues during the booking/)).toHaveCount(0)
      await expectNoNextOverlay(page)
      await expectNoHorizontalOverflow(page, `cleaner cancelled re-authorisation booking detail at ${viewport.name}`)

      await page.goto('/cleaner/bookings', { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('No cleaner compensation — €0.00', { exact: true })).toBeVisible()
      await expect(page.getByText(/Payment re-authorisation pending - awaiting client/)).toHaveCount(0)
      await expectNoNextOverlay(page)
      await expectNoHorizontalOverflow(page, `cleaner cancelled re-authorisation bookings list at ${viewport.name}`)

      await page.goto('/cleaner/dashboard', { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible()
      await expect(page.getByText('Final payout: €0.00', { exact: true })).toBeVisible()
      await expect(page.getByText(/Payment re-authorisation pending - awaiting client/)).toHaveCount(0)
      await expectNoNextOverlay(page)
      await expectNoHorizontalOverflow(page, `cleaner cancelled re-authorisation dashboard at ${viewport.name}`)
    }
  })

  test('admin pending re-authorisation payment state shows released amount as previous', async ({ page }) => {
    test.skip(!e2eAuthBypassEnabled, 'Set MAIDHIVE_E2E_AUTH_BYPASS=1 for routed responsive auth bypass')

    await seedAdminBypass(page)
    const booking = bookingFixture()

    await mockSharedShell(page, 'admin')
    await page.route('**/api/v1/notifications**', (route) => fulfill(route, {
      notifications: [],
      total: 0,
      page: 1,
      page_size: 250,
    }))
    await page.route(`**/api/v1/admin/bookings/${BOOKING_ID}`, (route) => fulfill(route, booking))

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.goto(`/admin/bookings/${BOOKING_ID}`, { waitUntil: 'domcontentloaded' })
      const paymentState = page.getByTestId('admin-payment-state')
      await expect(paymentState.getByText('Stripe payment status', { exact: true })).toBeVisible()
      await expect(paymentState.getByText('Payment authorisation released', { exact: true })).toBeVisible()
      await expect(paymentState.getByText('Previous authorised amount', { exact: true })).toBeVisible()
      await expect(paymentState.getByText('€22.00 — released', { exact: true })).toBeVisible()
      await expect(paymentState.getByText('Authorised client amount', { exact: true })).toHaveCount(0)
      await expectNoNextOverlay(page)
      await expectNoHorizontalOverflow(page, `admin pending re-authorisation payment state at ${viewport.name}`)
    }
  })

  test('admin re-authorisation action log and original confirmation stay responsive', async ({ page }) => {
    test.skip(!e2eAuthBypassEnabled, 'Set MAIDHIVE_E2E_AUTH_BYPASS=1 for routed responsive auth bypass')

    await seedAdminBypass(page)
    const booking = bookingFixture({
      status: 'confirmed',
      reauthorization_required: false,
      reauthorization_grace_expires_at: null,
      pay_by: null,
      payment: {
        id: 'payment-reauth',
        status: 'authorized',
        amount: 22,
        platform_fee: 2,
        cleaner_payout: 20,
        currency: 'eur',
        authorized_at: isoHoursFromNow(-1),
        created_at: isoHoursFromNow(-50),
      },
      action_events: [
        ...(bookingFixture().action_events as any[]),
        {
          id: 'event-complete',
          type: 'payment_reauthorisation_completed',
          actor_role: 'system',
          metadata: {
            amount: 22,
            previous_confirmed_at: '2026-08-10T13:25:00.000Z',
          },
          created_at: isoHoursFromNow(-1),
        },
      ],
    })

    await mockSharedShell(page, 'admin')
    await page.route('**/api/v1/notifications**', (route) => fulfill(route, {
      notifications: [],
      total: 0,
      page: 1,
      page_size: 250,
    }))
    await page.route(`**/api/v1/admin/bookings/${BOOKING_ID}`, (route) => fulfill(route, booking))

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.goto(`/admin/bookings/${BOOKING_ID}`, { waitUntil: 'domcontentloaded' })
      const bookingState = page.getByTestId('admin-booking-state')
      await expect(bookingState.getByText('Originally confirmed', { exact: true })).toBeVisible()
      await expect(bookingState.getByText('Payment re-authorisation completed', { exact: true })).toBeVisible()
      const paymentState = page.getByTestId('admin-payment-state')
      await expect(paymentState.getByText('Authorised client amount', { exact: true })).toBeVisible()
      await expect(paymentState.getByText('Previous authorised amount', { exact: true })).toHaveCount(0)
      const actionLog = page.getByTestId('admin-booking-action-log')
      await expect(actionLog.getByText('Payment authorisation released — €22.00', { exact: true })).toBeVisible()
      await expect(actionLog.getByText(/booking requires client payment re-authorisation after reschedule/)).toBeVisible()
      await expect(actionLog.getByText('Card re-authorisation required', { exact: true })).toBeVisible()
      await expect(actionLog.getByText(/Client must re-authorise the card by/)).toBeVisible()
      await expect(actionLog.getByText('Payment re-authorisation completed', { exact: true })).toBeVisible()
      await expect(actionLog.getByText('New card authorisation recorded for €22.00. The booking remains confirmed.', { exact: true })).toBeVisible()
      await expectNoNextOverlay(page)
      await expectNoHorizontalOverflow(page, `admin re-authorisation booking detail at ${viewport.name}`)
    }
  })
})
