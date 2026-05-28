import { expect, test } from '@playwright/test'
import { authStatePath } from './auth-state'
import { hasRoleCredentialCandidates, parseApiResponse } from './helpers'

test.describe('F09 Reschedule + cancel policies @smoke', () => {
  test.setTimeout(120_000)
  test.describe('client session', () => {
    test.use({ storageState: authStatePath('client') })

    test('E2E-CANCEL-01 client can access bookings list routes for policy checks', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      await page.goto('/client/bookings')
      await expect(page).toHaveURL(/\/client\/bookings/)
    })

    test('E2E-CANCEL-01B booking flow opened from bookings shows "Back to bookings" and returns correctly', async ({ page }, testInfo) => {
      test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const listRes = await page.request.get('/api/v1/bookings?page=1&page_size=20')
      const list = await parseApiResponse<{ bookings?: Array<{ cleaner_id: string }> }>(listRes, testInfo)
      const cleanerId = list.data.bookings?.[0]?.cleaner_id
      test.skip(!cleanerId, 'No booking available to validate back-navigation wording from bookings source')

      await page.goto(`/client/book/${cleanerId}?reset=1&step=1&source=bookings`)
      const backButton = page.getByRole('button', { name: /Back to bookings/i })
      await expect(backButton).toBeVisible()
      await backButton.click()
      await expect(page).toHaveURL(/\/client\/bookings/)
    })

    test('E2E-CANCEL-02 invalid or ineligible cancellation returns explicit blocked response', async ({ page }) => {
      const cancelRes = await page.request.post('/api/v1/bookings/00000000-0000-0000-0000-000000000000/cancel', {
        data: { reason: 'Policy boundary smoke check' },
      })
      expect([400, 403, 404, 409]).toContain(cancelRes.status())
      const body = await cancelRes.json()
      expect(body.success).toBe(false)
    })
  })

  test.describe('cleaner session', () => {
    test.use({ storageState: authStatePath('cleaner') })

    test('E2E-CANCEL-03 cleaner can access cleaner bookings for amend/cancel policy actions', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('cleaner'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      await page.goto('/cleaner/bookings')
      await expect(page).toHaveURL(/\/cleaner\/bookings/)
    })

    test('E2E-CANCEL-04 invalid amend payload is rejected with validation error', async ({ page }, testInfo) => {
      const listRes = await page.request.get('/api/v1/bookings?page=1&page_size=20')
      const list = await parseApiResponse<{ bookings?: Array<{ id: string }> }>(listRes, testInfo)
      const booking = list.data.bookings?.[0]
      test.skip(!booking, 'No cleaner-visible booking available for amend validation smoke test')

      const amendRes = await page.request.post(`/api/v1/bookings/${booking?.id}/action`, {
        data: { action: 'amend_start_time' },
      })

      expect(amendRes.status()).toBe(422)
      const body = await amendRes.json()
      expect(body.success).toBe(false)
    })
  })
})
