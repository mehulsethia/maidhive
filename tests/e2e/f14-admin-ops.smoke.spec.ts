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
    })

    test('E2E-ADMIN-02 admin cleaner/user listing routes are accessible', async ({ page }, testInfo) => {
      const cleanersRes = await page.request.get('/api/v1/admin/cleaners?page=1&page_size=20')
      const cleaners = await parseApiResponse<{ cleaners: unknown[] }>(cleanersRes, testInfo)
      expect(Array.isArray(cleaners.data.cleaners)).toBe(true)

      const usersRes = await page.request.get('/api/v1/admin/users?page=1&page_size=20')
      const users = await parseApiResponse<{ users: unknown[] }>(usersRes, testInfo)
      expect(Array.isArray(users.data.users)).toBe(true)
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
