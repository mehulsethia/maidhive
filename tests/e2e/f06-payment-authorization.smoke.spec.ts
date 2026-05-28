import { expect, test } from '@playwright/test'
import {
  createDraftBooking,
  getFirstBookableSlot,
  getFirstCleaner,
  getPaymentMethodId,
  hasRoleCredentialCandidates,
  loginAsRole,
  parseApiResponse,
} from './helpers'

test.describe('F06 Payment authorization sync @smoke', () => {
  test('E2E-PAYAUTH-01 client authorizes payment and sees Pending Cleaner Acceptance', async ({ page }, testInfo) => {
    test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')
    test.skip(!getPaymentMethodId(), 'Set E2E_CLIENT_PAYMENT_METHOD_ID for saved-card authorization')

    await loginAsRole(page, 'client')
    const cleaner = await getFirstCleaner(page.request, testInfo)
    const { slot } = await getFirstBookableSlot(page.request, cleaner.id, 2, testInfo)
    const booking = await createDraftBooking(
      page.request,
      { cleanerId: cleaner.id, scheduledStart: slot, durationHours: 2 },
      testInfo,
    )

    const intentRes = await page.request.post('/api/v1/payments/intent', {
      data: { booking_id: booking.id },
    })
    await parseApiResponse(intentRes, testInfo)

    const confirmRes = await page.request.post('/api/v1/payments/confirm-existing', {
      data: {
        booking_id: booking.id,
        payment_method_id: getPaymentMethodId(),
      },
    })
    const confirmed = await parseApiResponse<{
      sync?: { updated?: boolean }
      payment_intent_status?: string
    }>(confirmRes, testInfo)
    expect(confirmed.data.payment_intent_status).toBe('requires_capture')
    expect(Boolean(confirmed.data.sync?.updated)).toBe(true)

    await page.goto(`/client/bookings/${booking.id}`)
    await expect(page.getByText('Pending Cleaner Acceptance')).toBeVisible()
  })

  test('E2E-PAYAUTH-02 authorization failure shows recoverable action path', async ({ page }, testInfo) => {
    test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')
    await loginAsRole(page, 'client')

    const cleaner = await getFirstCleaner(page.request, testInfo)
    const { slot } = await getFirstBookableSlot(page.request, cleaner.id, 2, testInfo)
    const booking = await createDraftBooking(
      page.request,
      { cleanerId: cleaner.id, scheduledStart: slot, durationHours: 2 },
      testInfo,
    )

    const intentRes = await page.request.post('/api/v1/payments/intent', {
      data: { booking_id: booking.id },
    })
    await parseApiResponse(intentRes, testInfo)

    const badConfirmRes = await page.request.post('/api/v1/payments/confirm-existing', {
      data: {
        booking_id: booking.id,
        payment_method_id: 'pm_invalid_for_account',
      },
    })
    expect(badConfirmRes.ok()).toBeFalsy()
    const badConfirmBody = await badConfirmRes.json()
    expect(badConfirmBody.success).toBe(false)

    await page.goto(`/client/bookings/${booking.id}`)
    await expect(page.getByRole('button', { name: 'Authorise card' })).toBeVisible()
    await expect(page.getByText('Authorise your card to send this booking request to the cleaner.')).toBeVisible()
  })

  test('E2E-PAYAUTH-03 duplicate submit does not create duplicate booking request', async ({ page }, testInfo) => {
    test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')
    test.skip(!getPaymentMethodId(), 'Set E2E_CLIENT_PAYMENT_METHOD_ID for saved-card authorization')

    await loginAsRole(page, 'client')
    const cleaner = await getFirstCleaner(page.request, testInfo)
    const { slot } = await getFirstBookableSlot(page.request, cleaner.id, 2, testInfo)
    const booking = await createDraftBooking(
      page.request,
      { cleanerId: cleaner.id, scheduledStart: slot, durationHours: 2 },
      testInfo,
    )

    const intentRes = await page.request.post('/api/v1/payments/intent', {
      data: { booking_id: booking.id },
    })
    await parseApiResponse(intentRes, testInfo)

    const firstConfirmRes = await page.request.post('/api/v1/payments/confirm-existing', {
      data: {
        booking_id: booking.id,
        payment_method_id: getPaymentMethodId(),
      },
    })
    await parseApiResponse(firstConfirmRes, testInfo)

    const secondConfirmRes = await page.request.post('/api/v1/payments/confirm-existing', {
      data: {
        booking_id: booking.id,
        payment_method_id: getPaymentMethodId(),
      },
    })
    expect(secondConfirmRes.ok()).toBeFalsy()
    const secondConfirmBody = await secondConfirmRes.json()
    expect(secondConfirmBody.success).toBe(false)
    expect(String(secondConfirmBody.message ?? '')).toMatch(/already/i)
  })
})
