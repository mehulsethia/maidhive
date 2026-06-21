import { expect, test, type Page } from '@playwright/test'
import { authStatePath } from './auth-state'

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const

async function assertResponsiveRoute(page: Page, path: string) {
  await page.setViewportSize(VIEWPORTS[0])
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/)
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }))
    expect(
      dimensions.document,
      `${path} should not overflow horizontally at ${viewport.name}`,
    ).toBeLessThanOrEqual(dimensions.viewport + 1)
  }
}

test.describe('F19 dispute and compensation responsive regression @smoke', () => {
  test.setTimeout(180_000)

  test.describe('admin session', () => {
    test.use({ storageState: authStatePath('admin') })

    test('E2E-RESP-01 admin dispute and booking history remain responsive across viewport classes', async ({ page }) => {
      await assertResponsiveRoute(page, '/admin/disputes')
      await expect(page.getByRole('button', { name: /Resolved Disputes/ })).toBeVisible({ timeout: 20_000 })

      await page.setViewportSize(VIEWPORTS[0])
      await page.waitForTimeout(6_000)
      const resolveButton = page.getByRole('button', { name: /^Resolve$/ }).first()
      if (await resolveButton.count()) {
        await resolveButton.click()
        const dialog = page.getByRole('dialog')
        await dialog.locator('select').selectOption('partial_refund')
        await expect(dialog.getByText('Refund amount (€)')).toBeVisible()
        await expect(dialog.getByText('Charge percentage (%)')).toHaveCount(0)
      }

      const bookingsResponse = await page.request.get('/api/v1/admin/bookings?page=1&page_size=1')
      expect(bookingsResponse.status()).toBe(200)
      const bookingsBody = await bookingsResponse.json()
      const bookingId = bookingsBody?.data?.bookings?.[0]?.id ?? bookingsBody?.data?.items?.[0]?.id
      if (bookingId) {
        await assertResponsiveRoute(page, `/admin/bookings/${bookingId}`)
      }
    })
  })

  test.describe('cleaner session', () => {
    test.use({ storageState: authStatePath('cleaner') })

    test('E2E-RESP-02 cleaner report, earnings, booking and payment surfaces remain responsive', async ({ page }) => {
      for (const path of ['/cleaner/report', '/cleaner/dashboard', '/cleaner/earnings', '/cleaner/profile?tab=payments']) {
        await assertResponsiveRoute(page, path)
      }

      await page.setViewportSize(VIEWPORTS[0])
      await assertResponsiveRoute(page, '/cleaner/dashboard')
      await expect(page.getByRole('button', {
        name: 'Includes completed booking payouts and any released compensation payments.',
      })).toBeVisible({ timeout: 20_000 })
      const disputedRecentCard = page.locator('[data-testid^="recent-activity-"]:has-text("Under Review")').first()
      if (await disputedRecentCard.count()) {
        await expect(disputedRecentCard.getByText(/Payout pending review €\d/)).toBeVisible()
      }

      const cancelledResponse = await page.request.get('/api/v1/bookings?page=1&page_size=1&status=cancelled')
      expect(cancelledResponse.status()).toBe(200)
      const cancelledBody = await cancelledResponse.json()
      const cancelledBooking = cancelledBody?.data?.bookings?.[0] ?? cancelledBody?.data?.items?.[0]
      const cancelledId = cancelledBooking?.id
      if (cancelledId) {
        await assertResponsiveRoute(page, `/cleaner/bookings/${cancelledId}`)
        if (cancelledBooking.cancelled_by) {
          await expect(page.getByText(/Cancelled by (client|cleaner|platform)/)).toBeVisible({ timeout: 20_000 })
        }
        await expect(page.getByText('Compensation outcome')).toBeVisible({ timeout: 20_000 })
      }
    })
  })

  test.describe('client session', () => {
    test.use({ storageState: authStatePath('client') })

    test('E2E-RESP-03 client cancellation, completed status, reports and spend remain responsive', async ({ page }) => {
      for (const path of ['/client/bookings', '/client/report', '/client/profile']) {
        await assertResponsiveRoute(page, path)
      }

      await page.setViewportSize(VIEWPORTS[0])
      await page.goto('/client/profile')
      await expect(page.getByRole('button', {
        name: 'Includes completed bookings and any cancellation or no-show charges paid through MaidHive.',
      })).toBeVisible({ timeout: 20_000 })

      await page.goto('/client/bookings')
      await expect(page.getByText(/Completed - (Awaiting Release|Released)/)).toHaveCount(0)

      const cancelledResponse = await page.request.get('/api/v1/bookings?page=1&page_size=1&status=cancelled')
      expect(cancelledResponse.status()).toBe(200)
      const cancelledBody = await cancelledResponse.json()
      const cancelledBooking = cancelledBody?.data?.bookings?.[0] ?? cancelledBody?.data?.items?.[0]
      if (cancelledBooking?.id) {
        await assertResponsiveRoute(page, `/client/bookings/${cancelledBooking.id}`)
        if (cancelledBooking.cancelled_by) {
          await expect(page.getByText(/Cancelled by (client|cleaner|platform)/)).toBeVisible({ timeout: 20_000 })
        }
      }
    })
  })
})
