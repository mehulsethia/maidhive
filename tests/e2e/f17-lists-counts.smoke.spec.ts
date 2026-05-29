import { expect, test, type Route } from '@playwright/test'
import { authStatePath } from './auth-state'
import { hasRoleCredentialCandidates, parseApiResponse } from './helpers'

test.describe('F17 Search/lists/counts consistency @smoke', () => {
  test.setTimeout(120_000)

  test.describe('client session', () => {
    test.use({ storageState: authStatePath('client') })

    test('E2E-LIST-01 counts endpoint and bookings list are both available', async ({ page }, testInfo) => {
      test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const countsRes = await page.request.get('/api/v1/counts')
      const counts = await parseApiResponse<{ unread_chats: number; pending_bookings: number; unread_notifications: number }>(countsRes, testInfo)

      const listRes = await page.request.get('/api/v1/bookings?page=1&page_size=20')
      const list = await parseApiResponse<{ bookings: Array<{ id: string }>; total: number }>(listRes, testInfo)

      expect(counts.data.unread_notifications).toBeGreaterThanOrEqual(0)
      expect(list.data.total).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(list.data.bookings)).toBe(true)
    })

    test('E2E-LIST-02 same filter query returns deterministic pagination envelope', async ({ page }, testInfo) => {
      const firstRes = await page.request.get('/api/v1/bookings?status=accepted&page=1&page_size=10')
      const secondRes = await page.request.get('/api/v1/bookings?status=accepted&page=1&page_size=10')

      const first = await parseApiResponse<{ bookings: Array<{ id: string }>; total: number; page: number; page_size: number }>(firstRes, testInfo)
      const second = await parseApiResponse<{ bookings: Array<{ id: string }>; total: number; page: number; page_size: number }>(secondRes, testInfo)

      expect(first.data.page).toBe(1)
      expect(first.data.page_size).toBe(10)
      expect(second.data.page).toBe(1)
      expect(second.data.page_size).toBe(10)
      expect(first.data.total).toBe(second.data.total)
    })

    test('E2E-LIST-03 booking list UI remains populated when API has bookings (browser/session consistency)', async ({ page }, testInfo) => {
      const listRes = await page.request.get('/api/v1/bookings?page=1&page_size=100')
      const list = await parseApiResponse<{ bookings: Array<{ id: string }>; total: number }>(listRes, testInfo)
      test.skip(list.data.total === 0, 'Account has no bookings to validate list hydration consistency')

      await page.goto('/client/bookings')
      await expect(page.getByText('No bookings found')).toHaveCount(0)
      await expect(page.getByText('View details').first()).toBeVisible()
    })

    test('E2E-LIST-04 cancelled/closed cards do not show active Message CTA', async ({ page }, testInfo) => {
      const listRes = await page.request.get('/api/v1/bookings?page=1&page_size=100')
      const list = await parseApiResponse<{ bookings: Array<{ id: string; status: string }> }>(listRes, testInfo)
      const closedId = (list.data.bookings ?? []).find((item) =>
        ['cancelled', 'declined', 'expired'].includes(String(item.status ?? '')),
      )?.id
      test.skip(!closedId, 'No closed booking found for Message-CTA visibility check')

      await page.goto('/client/bookings')
      const closedCard = page.locator('article').filter({ has: page.locator(`a[href="/client/bookings/${closedId}"]`) }).first()
      await expect(closedCard).toBeVisible()
      await expect(closedCard.getByRole('link', { name: /^Message$/i })).toHaveCount(0)
    })

    test('E2E-LIST-05 list page shows load-error state instead of false empty state on API failure', async ({ page }) => {
      const failWith503 = (urlLabel: string) => async (route: Route) => {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: `${urlLabel} unavailable`,
          }),
        })
      }

      await page.route('**/api/v1/bookings**', failWith503('bookings'))
      await page.route('**/api/v1/disputes**', failWith503('disputes'))
      await page.route('**/api/v1/notifications**', failWith503('notifications'))

      await page.goto('/client/bookings')
      await expect(page.getByText('Unable to load bookings')).toBeVisible()
      await expect(page.getByText('No bookings found')).toHaveCount(0)
    })
  })

  test.describe('cleaner session', () => {
    test.use({ storageState: authStatePath('cleaner') })

    test('E2E-LIST-06 cleaner list and counts endpoints respond with non-negative metrics', async ({ page }, testInfo) => {
      test.skip(!hasRoleCredentialCandidates('cleaner'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const listRes = await page.request.get('/api/v1/bookings?page=1&page_size=20')
      const list = await parseApiResponse<{ bookings: Array<{ id: string; status: string }>; total: number }>(listRes, testInfo)

      const countsRes = await page.request.get('/api/v1/counts')
      const counts = await parseApiResponse<{ pending_bookings: number }>(countsRes, testInfo)

      expect(list.data.total).toBeGreaterThanOrEqual(0)
      expect(counts.data.pending_bookings).toBeGreaterThanOrEqual(0)
    })
  })
})
