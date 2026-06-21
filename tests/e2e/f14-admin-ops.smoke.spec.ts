import { expect, test } from '@playwright/test'
import { authStatePath } from './auth-state'
import { hasRoleCredentialCandidates, parseApiResponse } from './helpers'

test.describe('F14 Admin queues/stats/actions @smoke', () => {
  test.setTimeout(120_000)

  test.describe('admin session', () => {
    test.use({ storageState: authStatePath('admin') })

    test('E2E-ADMIN-01 admin stats/bookings/ops routes return success envelopes', async ({ page }, testInfo) => {
      test.skip(!hasRoleCredentialCandidates('admin'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const statsRes = await page.request.get('/api/v1/admin/stats')
      const stats = await parseApiResponse<Record<string, number>>(statsRes, testInfo)
      expect(typeof stats.data.total_users).toBe('number')

      const bookingsRes = await page.request.get('/api/v1/admin/bookings?status=pending&page=1&page_size=20')
      const bookings = await parseApiResponse<{ bookings: unknown[]; total: number }>(bookingsRes, testInfo)
      expect(Array.isArray(bookings.data.bookings)).toBe(true)

      const opsRes = await page.request.get('/api/v1/admin/ops-queues')
      const ops = await parseApiResponse<Record<string, any>>(opsRes, testInfo)
      expect(ops.data.pending_cleaner_approvals).toBeTruthy()
      expect(ops.data.pending_booking_requests).toBeTruthy()
      expect(ops.data.active_disputes.breakdown).toEqual({
        open: expect.any(Number),
        awaiting_response: expect.any(Number),
        under_review: expect.any(Number),
      })
      expect(ops.data.active_disputes.count).toBe(
        ops.data.active_disputes.breakdown.open
          + ops.data.active_disputes.breakdown.awaiting_response
          + ops.data.active_disputes.breakdown.under_review,
      )
    })

    test('E2E-ADMIN-02 admin cleaner/user listing routes are accessible', async ({ page }, testInfo) => {
      const cleanersRes = await page.request.get('/api/v1/admin/cleaners?page=1&page_size=20')
      const cleaners = await parseApiResponse<{ cleaners: unknown[] }>(cleanersRes, testInfo)
      expect(Array.isArray(cleaners.data.cleaners)).toBe(true)

      const usersRes = await page.request.get('/api/v1/admin/users?page=1&page_size=20')
      const users = await parseApiResponse<{ users: unknown[] }>(usersRes, testInfo)
      expect(Array.isArray(users.data.users)).toBe(true)
    })

    test('E2E-ADMIN-04 dispute breakdown is visible without horizontal overflow', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('admin'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      for (const viewport of [
        { width: 390, height: 844 },
        { width: 768, height: 1024 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize(viewport)
        await page.goto('/admin')

        await expect(page.getByText('Open Disputes', { exact: true })).toBeVisible()
        await expect(page.getByText('Awaiting Response', { exact: true })).toBeVisible()
        await expect(page.getByText('Under Review', { exact: true })).toBeVisible()

        const hasHorizontalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        )
        expect(hasHorizontalOverflow).toBe(false)
      }
    })
  })

  test.describe('client session', () => {
    test.use({ storageState: authStatePath('client') })

    test('E2E-ADMIN-03 non-admin cannot access admin APIs', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const res = await page.request.get('/api/v1/admin/stats')
      const body = await res.json()
      expect(res.status()).toBe(403)
      expect(body.success).toBe(false)
    })
  })
})
