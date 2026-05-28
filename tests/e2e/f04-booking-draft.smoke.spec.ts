import { expect, test } from '@playwright/test'
import { authStatePath } from './auth-state'
import {
  getFirstBookableSlot,
  getFirstCleaner,
  hasRoleCredentialCandidates,
  parseApiResponse,
} from './helpers'

test.describe('F04 Booking draft lifecycle @smoke', () => {
  test.use({ storageState: authStatePath('client') })

  test('E2E-DRAFT-01 client can refresh each step and preserve draft state', async ({ page }, testInfo) => {
    test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')
    await page.goto('/client/dashboard')
    await expect(page).toHaveURL(/\/client\/dashboard/)

    const cleaner = await getFirstCleaner(page.request, testInfo)
    const { date, slot } = await getFirstBookableSlot(page.request, cleaner.id, 2, testInfo)

    const putRes = await page.request.put('/api/v1/bookings/draft', {
      data: {
        cleaner_id: cleaner.id,
        last_step: 2,
        duration_hours: 2,
        selected_date: date,
        selected_slot: slot,
        payload: {
          version: 1,
          step: 2,
          duration: 2,
          date,
          selectedSlot: slot,
          source: 'e2e-smoke',
        },
      },
    })
    await parseApiResponse(putRes, testInfo)

    await page.goto(`/client/book/${cleaner.id}`)
    await expect(page.getByRole('heading', { name: 'Address & Job Details' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Address & Job Details' })).toBeVisible()
  })

  test('E2E-DRAFT-02 payment interruption recovers to valid prior step without crash', async ({ page }, testInfo) => {
    test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')
    await page.goto('/client/dashboard')

    const cleaner = await getFirstCleaner(page.request, testInfo)
    const { date, slot } = await getFirstBookableSlot(page.request, cleaner.id, 2, testInfo)

    const putRes = await page.request.put('/api/v1/bookings/draft', {
      data: {
        cleaner_id: cleaner.id,
        last_step: 3,
        duration_hours: 2,
        selected_date: date,
        selected_slot: slot,
        payload: {
          version: 1,
          step: 3,
          duration: 2,
          date,
          selectedSlot: slot,
          source: 'e2e-smoke-payment-interruption',
        },
      },
    })
    await parseApiResponse(putRes, testInfo)

    await page.goto(`/client/book/${cleaner.id}`)
    await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible()

    await page.goto('/client/dashboard')
    await expect(page).toHaveURL(/\/client\/dashboard/)

    await page.goto(`/client/book/${cleaner.id}`)
    await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible()
  })

  test('E2E-DRAFT-03 draft does not notify cleaner before authorization', async ({ page }, testInfo) => {
    test.skip(
      !hasRoleCredentialCandidates('client') || !hasRoleCredentialCandidates('cleaner'),
      'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair',
    )
    await page.goto('/client/dashboard')

    const cleaner = await getFirstCleaner(page.request, testInfo)
    const { date, slot } = await getFirstBookableSlot(page.request, cleaner.id, 2, testInfo)

    const putRes = await page.request.put('/api/v1/bookings/draft', {
      data: {
        cleaner_id: cleaner.id,
        last_step: 2,
        duration_hours: 2,
        selected_date: date,
        selected_slot: slot,
        payload: { version: 1, step: 2, duration: 2, date, selectedSlot: slot },
      },
    })
    await parseApiResponse(putRes, testInfo)

    const notificationsBeforeRes = await page.request.get('/api/v1/notifications')
    const notificationsBefore = await parseApiResponse<{ notifications?: Array<{ type?: string }> }>(notificationsBeforeRes, testInfo)
    const bookingRequestCountBefore = (notificationsBefore.data.notifications ?? []).filter(
      (item) => item.type === 'booking_request',
    ).length

    await page.goto(`/client/book/${cleaner.id}`)
    await expect(page.getByRole('heading', { name: 'Address & Job Details' })).toBeVisible()

    const notificationsAfterRes = await page.request.get('/api/v1/notifications')
    const notificationsAfter = await parseApiResponse<{ notifications?: Array<{ type?: string }> }>(notificationsAfterRes, testInfo)
    const bookingRequestCountAfter = (notificationsAfter.data.notifications ?? []).filter(
      (item) => item.type === 'booking_request',
    ).length

    expect(bookingRequestCountAfter).toBe(bookingRequestCountBefore)
  })
})
