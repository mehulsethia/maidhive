import { expect, test } from '@playwright/test'
import { authStatePath } from './auth-state'
import { hasRoleCredentialCandidates, parseApiResponse } from './helpers'

test.describe('F16 Resilience and failure isolation @smoke', () => {
  test.setTimeout(120_000)

  test.describe('client session', () => {
    test.use({ storageState: authStatePath('client') })

    test('E2E-RES-01 key pages load without white-screen and protected APIs remain responsive', async ({ page }, testInfo) => {
      test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      await page.goto('/client/dashboard')
      await expect(page).toHaveURL(/\/client\/dashboard/)

      await page.goto('/client/bookings')
      await expect(page).toHaveURL(/\/client\/bookings/)

      const countsRes = await page.request.get('/api/v1/counts')
      const counts = await parseApiResponse<{ unread_chats: number; pending_bookings: number; unread_notifications: number }>(countsRes, testInfo)
      expect(counts.data.unread_chats).toBeGreaterThanOrEqual(0)
      expect(counts.data.pending_bookings).toBeGreaterThanOrEqual(0)
    })

    test('E2E-RES-02 transient failure path returns deterministic error and session stays usable', async ({ page }) => {
      const syncRes = await page.request.post('/api/v1/payments/sync/00000000-0000-0000-0000-000000000001')
      const syncBody = await syncRes.json()

      expect([403, 404]).toContain(syncRes.status())
      expect(syncBody.success).toBe(false)

      await page.goto('/client/dashboard')
      await expect(page).toHaveURL(/\/client\/dashboard/)
    })
  })

  test.describe('admin session', () => {
    test.use({ storageState: authStatePath('admin') })

    test('E2E-RES-03 reconcile endpoint auth and response envelope remain deterministic', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('admin'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const res = await page.request.post('/api/v1/jobs/reconcile')
      const body = await res.json()

      expect([200, 401]).toContain(res.status())
      if (res.status() === 200) {
        expect(body.success).toBe(true)
      } else {
        expect(body.success).toBe(false)
      }
    })
  })
})
