import { expect, test, type Page } from '@playwright/test'

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }))
  expect(dimensions.document, `${context} should not overflow horizontally`)
    .toBeLessThanOrEqual(dimensions.viewport + 1)
}

async function expectNoNextOverlay(page: Page) {
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)
}

async function expectNoRestrictedPublicClaims(page: Page) {
  const text = await page.locator('body').innerText()
  expect(text).not.toMatch(/\bvetted\b/i)
  expect(text).not.toMatch(/background check/i)
  expect(text).not.toMatch(/Insurance coverage/i)
  expect(text).not.toMatch(/weekly deposits/i)
  expect(text).not.toMatch(/Join hundreds/i)
  expect(text).not.toMatch(/within 48 hours/i)
  expect(text).not.toContain('£')
}

async function verifyRouteFrame(page: Page, route: string, viewportName: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await expectNoNextOverlay(page)
  await expectNoHorizontalOverflow(page, `${route} at ${viewportName}`)
  await expectNoRestrictedPublicClaims(page)
}

test.describe('pre-launch public UI responsive coverage', () => {
  for (const viewport of VIEWPORTS) {
    test(`client landing page is responsive at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await verifyRouteFrame(page, '/', viewport.name)

      await expect(page.getByRole('heading', { name: 'A better way to book a cleaner' })).toBeVisible()
      await expect(page.getByText('Book approved cleaners in Larnaca with clear hourly pricing and secure payments')).toBeVisible()
      await expect(page.getByText('Your payment is authorised before the booking and only charged after the cleaning is completed.')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'End-of-tenancy cleaning' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Client FAQs' })).toHaveAttribute('href', '/faqs/clients')
      await expect(page.getByRole('link', { name: 'Cleaner FAQs' })).toHaveAttribute('href', '/faqs/cleaners')
    })

    test(`cleaner landing page is responsive at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await verifyRouteFrame(page, '/for-cleaners', viewport.name)

      await expect(page.getByRole('heading', { name: 'Become a MaidHive Cleaner' })).toBeVisible()
      await expect(page.getByText('No platform fees deducted from your earnings')).toBeVisible()
      await expect(page.getByText('Cleaner earnings:')).toBeVisible()
      await expect(page.getByText('€30.00')).toHaveCount(2)
      await expect(page.getByRole('heading', { name: 'Looking for a cleaner instead?' })).toBeVisible()
    })

    test(`client FAQs are responsive and collapsed at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await verifyRouteFrame(page, '/faqs/clients', viewport.name)

      await expect(page.getByRole('heading', { name: 'Client FAQs' })).toBeVisible()
      await expect(page.locator('details')).toHaveCount(12)
      await expect(page.locator('details[open]')).toHaveCount(0)
      await page.getByText('How does booking a cleaner work?').click()
      await expect(page.locator('details[open]')).toHaveCount(1)
      await expect(page.getByText('At the final step, you’ll be asked to authorise your payment method')).toBeVisible()
      await expectNoHorizontalOverflow(page, `/faqs/clients opened accordion at ${viewport.name}`)
    })

    test(`cleaner FAQs are responsive and collapsed at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await verifyRouteFrame(page, '/faqs/cleaners', viewport.name)

      await expect(page.getByRole('heading', { name: 'Cleaner FAQs' })).toBeVisible()
      await expect(page.locator('details')).toHaveCount(12)
      await expect(page.locator('details[open]')).toHaveCount(0)
      await page.getByText('Does MaidHive deduct a platform fee from my hourly earnings?').click()
      await expect(page.locator('details[open]')).toHaveCount(1)
      await expect(page.getByText('MaidHive’s platform fee is charged separately to the client')).toBeVisible()
      await expectNoHorizontalOverflow(page, `/faqs/cleaners opened accordion at ${viewport.name}`)
    })

    test(`account access pages are responsive at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      await verifyRouteFrame(page, '/login', viewport.name)
      await expect(page.locator('h1').filter({ hasText: 'Log in to MaidHive' })).toBeVisible()
      await expect(page.getByText('Access your MaidHive account and manage your bookings, profile and account details.')).toHaveCount(2)

      await verifyRouteFrame(page, '/signup', viewport.name)
      await expect(page.locator('h1').filter({ hasText: 'Join MaidHive' })).toBeVisible()
      await expect(page.getByText('Create your MaidHive account to get started as a client or cleaner.')).toHaveCount(2)
      await expect(page.getByRole('button', { name: "I'm a Client" })).toBeVisible()
      await expect(page.getByRole('button', { name: "I'm a Cleaner" })).toBeVisible()
    })
  }
})
