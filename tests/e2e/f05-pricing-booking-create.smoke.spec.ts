import { expect, test } from '@playwright/test'
import {
  createDraftBooking,
  getFirstBookableSlot,
  getFirstCleaner,
  hasRoleCredentialCandidates,
  loginAsRole,
  parseApiResponse,
} from './helpers'

test.describe('F05 Pricing + booking creation @smoke', () => {
  test('E2E-PRICE-01 booking summary matches server preview before payment', async ({ page }, testInfo) => {
    test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')
    await loginAsRole(page, 'client')

    const cleaner = await getFirstCleaner(page.request, testInfo)
    const durationHours = 2

    const previewRes = await page.request.post('/api/v1/bookings/preview-price', {
      data: {
        cleaner_id: cleaner.id,
        duration_hours: durationHours,
      },
    })
    const preview = await parseApiResponse<{
      hourly_rate: number
      subtotal: number
      platform_fee: number
      total_amount: number
    }>(previewRes, testInfo)

    const { slot } = await getFirstBookableSlot(page.request, cleaner.id, durationHours, testInfo)
    const booking = await createDraftBooking(
      page.request,
      {
        cleanerId: cleaner.id,
        scheduledStart: slot,
        durationHours,
      },
      testInfo,
    )

    expect(booking.hourly_rate).toBe(preview.data.hourly_rate)
    expect(booking.subtotal).toBe(preview.data.subtotal)
    expect(booking.platform_fee).toBe(preview.data.platform_fee)
    expect(booking.total_amount).toBe(preview.data.total_amount)

    await page.goto(`/client/bookings/${booking.id}`)
    await expect(page.getByText('Booking Information')).toBeVisible()
    await expect(
      page.getByText(
        new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(booking.total_amount),
      ),
    ).toBeVisible()
  })

  test('E2E-PRICE-02 resumed draft keeps snapshot stable unless duration/time changed', async ({ page }, testInfo) => {
    test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')
    await loginAsRole(page, 'client')

    const cleaner = await getFirstCleaner(page.request, testInfo)
    const durationHours = 2
    const { slot } = await getFirstBookableSlot(page.request, cleaner.id, durationHours, testInfo)

    const booking = await createDraftBooking(
      page.request,
      {
        cleanerId: cleaner.id,
        scheduledStart: slot,
        durationHours,
      },
      testInfo,
    )

    await page.goto(`/client/bookings/${booking.id}`)
    await expect(page.getByText('Booking Information')).toBeVisible()
    const totalBefore = booking.total_amount

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Booking Information')).toBeVisible()
    await expect(
      page.getByText(
        new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(totalBefore),
      ),
    ).toBeVisible()

    const bookingRes = await page.request.get(`/api/v1/bookings/${booking.id}`)
    const bookingAfter = await parseApiResponse<{ total_amount: number }>(bookingRes, testInfo)
    expect(bookingAfter.data.total_amount).toBe(totalBefore)
  })
})
