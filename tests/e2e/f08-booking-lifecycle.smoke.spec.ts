import { expect, request as playwrightRequest, test } from '@playwright/test'
import { authStatePath } from './auth-state'
import { hasRoleCredentialCandidates, parseApiResponse } from './helpers'

test.describe('F08 Booking lifecycle + reconcile @smoke', () => {
  test.setTimeout(120_000)
  test.use({ storageState: authStatePath('cleaner') })

  test('E2E-LIFECYCLE-01 cleaner can load dashboard and protected lifecycle routes stay accessible', async ({ page }) => {
    test.skip(!hasRoleCredentialCandidates('cleaner'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

    await page.goto('/cleaner/dashboard')
    await expect(page).toHaveURL(/\/cleaner\/dashboard|\/cleaner\/onboarding/)

    const nextJobLink = page.getByRole('link', { name: 'Open next job details' })
    if (await nextJobLink.count()) {
      await expect(nextJobLink.first()).toHaveAttribute('href', /\/cleaner\/bookings\/.+/)
    }
  })

  test('E2E-LIFECYCLE-02 reconcile endpoint blocks unauthorized access deterministically', async ({ request }) => {
    const res = await request.post('/api/v1/jobs/reconcile')
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  test('E2E-LIFECYCLE-03 cleaner complete endpoint is reachable for assigned in-progress booking', async ({ page }, testInfo) => {
    test.skip(!hasRoleCredentialCandidates('cleaner'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

    await page.goto('/cleaner/dashboard')

    const bookingsRes = await page.request.get('/api/v1/bookings?page=1&page_size=20&status=in_progress')
    const bookings = await parseApiResponse<{ bookings?: Array<{ id: string }> }>(bookingsRes, testInfo)
    const target = bookings.data.bookings?.[0]
    test.skip(!target, 'No in-progress booking available for cleaner completion smoke path')

    const completeRes = await page.request.post(`/api/v1/bookings/${target?.id}/complete`)
    expect([200, 400, 409]).toContain(completeRes.status())
  })

  test('E2E-LIFECYCLE-04 admin can trigger reconcile with secret when configured', async ({ baseURL }) => {
    const secret = process.env.JOBS_SECRET ?? process.env.CRON_SECRET
    test.skip(!secret, 'Set JOBS_SECRET or CRON_SECRET to run authorized reconcile smoke path')

    const adminReq = await playwrightRequest.newContext({
      baseURL,
      storageState: authStatePath('admin'),
    })

    const res = await adminReq.post('/api/v1/jobs/reconcile', {
      headers: { 'x-jobs-secret': String(secret) },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)

    await adminReq.dispose()
  })
})
