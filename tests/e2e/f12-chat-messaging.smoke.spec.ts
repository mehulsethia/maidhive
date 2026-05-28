import { expect, test } from '@playwright/test'
import { authStatePath } from './auth-state'
import { hasRoleCredentialCandidates, parseApiResponse } from './helpers'

test.describe('F12 Messaging + chat gating @smoke', () => {
  test.setTimeout(120_000)

  test.describe('client session', () => {
    test.use({ storageState: authStatePath('client') })

    async function findBookingForChat(page: any, testInfo: any) {
      const statuses = ['in_progress', 'completed', 'confirmed', 'disputed']
      for (const status of statuses) {
        const res = await page.request.get(`/api/v1/bookings?status=${status}&page=1&page_size=20`)
        if (!res.ok()) continue
        const parsed = await parseApiResponse<{ bookings: Array<{ id: string }> }>(res, testInfo)
        const id = parsed.data.bookings?.[0]?.id
        if (id) return id
      }
      return null
    }

    test('E2E-CHAT-01 chat history is available only for eligible booking states', async ({ page }, testInfo) => {
      test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const bookingId = await findBookingForChat(page, testInfo)
      test.skip(!bookingId, 'No eligible booking found for chat history smoke')

      const messagesRes = await page.request.get(`/api/v1/messages/${bookingId}`)
      const body = await messagesRes.json()
      expect(messagesRes.status()).toBe(200)
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
    })

    test('E2E-CHAT-02 posting message respects state gating (accepted or explicit blocked reason)', async ({ page }, testInfo) => {
      const bookingId = await findBookingForChat(page, testInfo)
      test.skip(!bookingId, 'No eligible booking found for chat post smoke')

      const postRes = await page.request.post(`/api/v1/messages/${bookingId}`, {
        data: { content: `E2E smoke ping ${Date.now()}` },
      })

      const postBody = await postRes.json()
      expect([200, 201, 400]).toContain(postRes.status())
      if (postRes.ok()) {
        expect(postBody.success).toBe(true)
      } else {
        expect(postBody.success).toBe(false)
        expect(String(postBody.message ?? '').toLowerCase()).toMatch(/closed|unavailable|forbidden/)
      }
    })

    test('E2E-CHAT-03 pending/draft booking chat is blocked when such booking exists', async ({ page }, testInfo) => {
      const res = await page.request.get('/api/v1/bookings?status=pending&page=1&page_size=20')
      if (!res.ok()) {
        test.skip(true, 'Pending bookings list not available for this account')
      }
      const parsed = await parseApiResponse<{ bookings: Array<{ id: string }> }>(res, testInfo)
      const pendingBookingId = parsed.data.bookings?.[0]?.id
      test.skip(!pendingBookingId, 'No pending booking found for pending-chat block assertion')

      const messagesRes = await page.request.get(`/api/v1/messages/${pendingBookingId}`)
      const body = await messagesRes.json()
      expect([400, 403]).toContain(messagesRes.status())
      expect(body.success).toBe(false)
    })
  })

  test.describe('cleaner session', () => {
    test.use({ storageState: authStatePath('cleaner') })

    test('E2E-CHAT-04 cleaner cannot read unrelated/random booking chat history', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('cleaner'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const randomBookingId = '00000000-0000-0000-0000-000000000001'
      const res = await page.request.get(`/api/v1/messages/${randomBookingId}`)
      const body = await res.json()

      expect([400, 403, 404]).toContain(res.status())
      expect(body.success).toBe(false)
    })
  })
})
