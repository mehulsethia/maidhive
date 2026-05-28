import { expect, test } from '@playwright/test'
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
  })

  test.describe('cleaner session', () => {
    test.use({ storageState: authStatePath('cleaner') })

    test('E2E-LIST-03 cleaner list and counts endpoints respond with non-negative metrics', async ({ page }, testInfo) => {
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
