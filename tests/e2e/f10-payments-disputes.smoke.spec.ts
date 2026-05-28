import { expect, test } from '@playwright/test'
import { authStatePath } from './auth-state'
import { hasRoleCredentialCandidates } from './helpers'

test.describe('F10 Payments + disputes @smoke', () => {
  test.setTimeout(120_000)
  test.describe('client session', () => {
    test.use({ storageState: authStatePath('client') })

    test('E2E-PAY-01 client payments endpoint enforces booking ownership', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const paymentRes = await page.request.get('/api/v1/payments/00000000-0000-0000-0000-000000000000')
      expect([403, 404]).toContain(paymentRes.status())
    })

    test('E2E-PAY-03 client dispute list route loads and returns deterministic payload', async ({ page }) => {
      await page.goto('/client/report')
      const disputesRes = await page.request.get('/api/v1/disputes?page=1&page_size=20')
      expect(disputesRes.status()).toBe(200)
      const body = await disputesRes.json()
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data.disputes)).toBe(true)
    })
  })

  test.describe('admin session', () => {
    test.use({ storageState: authStatePath('admin') })

    test('E2E-PAY-02 admin disputes queue route is accessible', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('admin'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      await page.goto('/admin/disputes')
      await expect(page).toHaveURL(/\/admin\/disputes/)

      const disputesRes = await page.request.get('/api/v1/disputes?page=1&page_size=20')
      expect(disputesRes.status()).toBe(200)
    })

    test('E2E-PAY-04 invalid dispute status patch payload is rejected', async ({ page }) => {
      const listRes = await page.request.get('/api/v1/disputes?page=1&page_size=20')
      const listBody = await listRes.json()
      const dispute = listBody?.data?.disputes?.[0]
      test.skip(!dispute?.id, 'No dispute available for admin status validation smoke test')

      const patchRes = await page.request.patch(`/api/v1/disputes/${dispute.id}/status`, {
        data: { status: 'resolved' },
      })

      expect(patchRes.status()).toBe(422)
      const patchBody = await patchRes.json()
      expect(patchBody.success).toBe(false)
    })

    test('E2E-PAY-05 capture endpoint blocks non-completed/non-authorized paths safely', async ({ page }) => {
      const captureRes = await page.request.post('/api/v1/payments/capture/00000000-0000-0000-0000-000000000000')
      expect([400, 404]).toContain(captureRes.status())
    })
  })
})
