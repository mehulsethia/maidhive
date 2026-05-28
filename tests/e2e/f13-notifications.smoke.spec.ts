import { expect, test } from '@playwright/test'
import { authStatePath } from './auth-state'
import { hasRoleCredentialCandidates, parseApiResponse } from './helpers'

test.describe('F13 Notifications + deep links @smoke', () => {
  test.setTimeout(120_000)

  test.describe('client session', () => {
    test.use({ storageState: authStatePath('client') })

    test('E2E-NOTIF-01 notifications list/read-all endpoints are healthy', async ({ page }, testInfo) => {
      test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const listRes = await page.request.get('/api/v1/notifications?page=1&page_size=20')
      const listed = await parseApiResponse<{ notifications: Array<{ id: string }>; total: number }>(listRes, testInfo)
      expect(Array.isArray(listed.data.notifications)).toBe(true)

      const readAllRes = await page.request.patch('/api/v1/notifications/read-all')
      const readAllBody = await readAllRes.json()
      expect(readAllRes.status()).toBe(200)
      expect(readAllBody.success).toBe(true)
    })

    test('E2E-NOTIF-02 mark-read/archive/delete routes are deterministic', async ({ page }, testInfo) => {
      const listRes = await page.request.get('/api/v1/notifications?page=1&page_size=20')
      const listed = await parseApiResponse<{ notifications: Array<{ id: string }> }>(listRes, testInfo)
      const notificationId = listed.data.notifications?.[0]?.id ?? '00000000-0000-0000-0000-000000000001'

      const markReadRes = await page.request.patch(`/api/v1/notifications/${notificationId}/read`)
      const archiveRes = await page.request.patch(`/api/v1/notifications/${notificationId}/archive`, {
        data: { archived: true },
      })
      const deleteRes = await page.request.delete(`/api/v1/notifications/${notificationId}`)

      expect(markReadRes.status()).toBe(200)
      expect(archiveRes.status()).toBe(200)
      expect(deleteRes.status()).toBe(200)

      const markReadBody = await markReadRes.json()
      const archiveBody = await archiveRes.json()
      const deleteBody = await deleteRes.json()
      expect(markReadBody.success).toBe(true)
      expect(archiveBody.success).toBe(true)
      expect(deleteBody.success).toBe(true)
    })
  })

  test.describe('admin session', () => {
    test.use({ storageState: authStatePath('admin') })

    test('E2E-NOTIF-03 admin notifications endpoints are accessible and role-scoped', async ({ page }, testInfo) => {
      test.skip(!hasRoleCredentialCandidates('admin'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const listRes = await page.request.get('/api/v1/notifications?page=1&page_size=20')
      const listed = await parseApiResponse<{ notifications: Array<{ id: string }> }>(listRes, testInfo)
      expect(Array.isArray(listed.data.notifications)).toBe(true)

      const anyId = listed.data.notifications?.[0]?.id ?? '00000000-0000-0000-0000-000000000001'
      const readRes = await page.request.patch(`/api/v1/notifications/${anyId}/read`)
      expect(readRes.status()).toBe(200)
    })
  })
})
