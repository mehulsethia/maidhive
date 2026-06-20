import { expect, test, type Page } from '@playwright/test'
import { authStatePath } from './auth-state'

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const

async function assertResponsiveRoute(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }))
  expect(dimensions.document, `${path} should not overflow horizontally`).toBeLessThanOrEqual(dimensions.viewport + 1)
}

test.describe('F19 dispute and compensation responsive regression @smoke', () => {
  test.setTimeout(180_000)

  test.describe('admin session', () => {
    test.use({ storageState: authStatePath('admin') })

    test('E2E-RESP-01 admin dispute and booking history remain responsive across viewport classes', async ({ page }) => {
      for (const viewport of VIEWPORTS) {
        await test.step(viewport.name, async () => {
          await page.setViewportSize(viewport)
          await assertResponsiveRoute(page, '/admin/disputes')
        })
      }

      await page.setViewportSize(VIEWPORTS[0])
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
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize(viewport)
          await assertResponsiveRoute(page, `/admin/bookings/${bookingId}`)
        }
      }
    })
  })

  test.describe('cleaner session', () => {
    test.use({ storageState: authStatePath('cleaner') })

    test('E2E-RESP-02 cleaner report, earnings, booking and payment surfaces remain responsive', async ({ page }) => {
      for (const viewport of VIEWPORTS) {
        await test.step(viewport.name, async () => {
          await page.setViewportSize(viewport)
          for (const path of ['/cleaner/report', '/cleaner/dashboard', '/cleaner/earnings', '/cleaner/profile?tab=payments']) {
            await assertResponsiveRoute(page, path)
          }
        })
      }

      await page.setViewportSize(VIEWPORTS[0])
      await assertResponsiveRoute(page, '/cleaner/dashboard')
      await expect(page.getByRole('button', {
        name: 'Includes completed booking payouts and any released compensation payments.',
      })).toBeVisible()

      const cancelledResponse = await page.request.get('/api/v1/bookings?page=1&page_size=1&status=cancelled')
      expect(cancelledResponse.status()).toBe(200)
      const cancelledBody = await cancelledResponse.json()
      const cancelledId = cancelledBody?.data?.bookings?.[0]?.id ?? cancelledBody?.data?.items?.[0]?.id
      if (cancelledId) {
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize(viewport)
          await assertResponsiveRoute(page, `/cleaner/bookings/${cancelledId}`)
          await expect(page.getByText(/Cancelled by (client|cleaner|platform)/)).toBeVisible()
          await expect(page.getByText('Compensation outcome')).toBeVisible()
        }
      }
    })
  })
})
