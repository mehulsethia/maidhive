import { expect, test } from '@playwright/test'
import { authStatePath } from './auth-state'
import { hasRoleCredentialCandidates, parseApiResponse } from './helpers'

test.describe('F15 Security boundaries + tenant isolation @smoke', () => {
  test.setTimeout(120_000)

  test.describe('client session', () => {
    test.use({ storageState: authStatePath('client') })

    test('E2E-SEC-01 forced admin API access is blocked', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const res = await page.request.get('/api/v1/admin/users?page=1&page_size=20')
      const body = await res.json()

      expect(res.status()).toBe(403)
      expect(body.success).toBe(false)
    })

    test('E2E-SEC-02 upload route rejects invalid file types', async ({ page }) => {
      const res = await page.request.post('/api/v1/upload/profile-image', {
        multipart: {
          file: {
            name: 'malicious.exe',
            mimeType: 'application/x-msdownload',
            buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
          },
        },
      })
      const body = await res.json()

      expect(res.status()).toBe(400)
      expect(body.success).toBe(false)
    })

    test('E2E-SEC-03 booking detail tampering with random id is blocked', async ({ page }) => {
      const res = await page.request.get('/api/v1/bookings/00000000-0000-0000-0000-000000000001')
      expect([403, 404]).toContain(res.status())
    })
  })

  test.describe('cleaner session', () => {
    test.use({ storageState: authStatePath('cleaner') })

    test('E2E-SEC-04 cleaner cannot use client-only sync/payment endpoints', async ({ page }, testInfo) => {
      test.skip(!hasRoleCredentialCandidates('cleaner'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const listRes = await page.request.get('/api/v1/bookings?page=1&page_size=20')
      const list = await parseApiResponse<{ bookings: Array<{ id: string }> }>(listRes, testInfo)
      const bookingId = list.data.bookings?.[0]?.id ?? '00000000-0000-0000-0000-000000000001'

      const syncRes = await page.request.post(`/api/v1/payments/sync/${bookingId}`)
      const body = await syncRes.json()

      expect([403, 404]).toContain(syncRes.status())
      expect(body.success).toBe(false)
    })
  })
})
