import { expect, test } from '@playwright/test'
import { authStatePath } from './auth-state'
import { getFirstCleaner, hasRoleCredentialCandidates, parseApiResponse } from './helpers'

test.describe('F11 Availability + conflict prevention @smoke', () => {
  test.describe('cleaner session', () => {
    test.use({ storageState: authStatePath('cleaner') })

    test('E2E-AVAIL-01 cleaner can read and update weekly availability schedule', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('cleaner'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const getBefore = await page.request.get('/api/v1/availability/me')
      expect(getBefore.status()).toBe(200)

      const putRes = await page.request.put('/api/v1/availability/me', {
        data: {
          schedules: [
            {
              day_of_week: 1,
              start_time: '09:00',
              end_time: '17:00',
              buffer_minutes: 30,
              is_active: true,
            },
          ],
        },
      })
      expect(putRes.status()).toBe(200)

      const getAfter = await page.request.get('/api/v1/availability/me')
      const body = await getAfter.json()
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBeGreaterThan(0)
    })

    test('E2E-AVAIL-02 cleaner blocked date add/list/delete flow works end to end', async ({ page }) => {
      const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      start.setUTCHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setUTCDate(end.getUTCDate() + 1)

      const addRes = await page.request.post('/api/v1/availability/me/blocked', {
        data: {
          start_datetime: start.toISOString(),
          end_datetime: end.toISOString(),
          reason: 'E2E smoke blocked day',
        },
      })
      expect([201, 409]).toContain(addRes.status())

      const listRes = await page.request.get('/api/v1/availability/me/blocked-list')
      expect(listRes.status()).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.success).toBe(true)

      const created = listBody.data.find((item: any) => item.reason === 'E2E smoke blocked day')
      if (created?.id) {
        const deleteRes = await page.request.delete(`/api/v1/availability/me/blocked/${created.id}`)
        expect(deleteRes.status()).toBe(200)
      }
    })
  })

  test.describe('client session', () => {
    test.use({ storageState: authStatePath('client') })

    test('E2E-AVAIL-03 client sees available dates and slots for a cleaner', async ({ page }, testInfo) => {
      test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const cleaner = await getFirstCleaner(page.request, testInfo)

      const datesRes = await page.request.get(
        `/api/v1/availability/${cleaner.id}/dates?duration_hours=2&days_ahead=14`,
      )
      const dates = await parseApiResponse<string[]>(datesRes, testInfo)
      expect(dates.data.length).toBeGreaterThan(0)

      const firstDate = dates.data[0]
      const slotsRes = await page.request.get(
        `/api/v1/availability/${cleaner.id}/slots?date=${encodeURIComponent(firstDate)}&duration_hours=2`,
      )
      const slots = await parseApiResponse<Array<{ start: string; disabled?: boolean }>>(slotsRes, testInfo)

      expect(Array.isArray(slots.data)).toBe(true)
      expect(slots.data.length).toBeGreaterThan(0)
    })

    test('E2E-AVAIL-04 invalid slot query is rejected with 422', async ({ page }, testInfo) => {
      const cleaner = await getFirstCleaner(page.request, testInfo)

      const badRes = await page.request.get(
        `/api/v1/availability/${cleaner.id}/slots?date=20-06-2026&duration_hours=0`,
      )
      expect(badRes.status()).toBe(422)
      const body = await badRes.json()
      expect(body.success).toBe(false)
    })
  })
})
