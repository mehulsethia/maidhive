import { expect, test, type Page } from '@playwright/test'
import { authStatePath } from './auth-state'

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
]

const now = '2026-07-18T10:00:00.000Z'

function authCookieName() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://phbbzgszfbnvvksklzss.supabase.co'
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  return `sb-${projectRef}-auth-token`
}

function base64Url(input: unknown) {
  return Buffer.from(JSON.stringify(input))
    .toString('base64url')
}

function fakeJwt() {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60
  return [
    base64Url({ alg: 'HS256', typ: 'JWT' }),
    base64Url({
      aud: 'authenticated',
      exp: expiresAt,
      sub: 'admin-user',
      email: 'admin@example.com',
      role: 'authenticated',
      user_metadata: { role: 'admin' },
    }),
    'test-signature',
  ].join('.')
}

async function seedAdminSession(page: Page) {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60
  const accessToken = fakeJwt()
  const session = {
    access_token: accessToken,
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    expires_at: expiresAt,
    token_type: 'bearer',
    user: {
      id: 'admin-user',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin@example.com',
      user_metadata: { role: 'admin' },
    },
  }
  const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`

  await page.context().addCookies([
    {
      name: authCookieName(),
      value: cookieValue,
      domain: 'localhost',
      path: '/',
      expires: expiresAt,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ])

  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value)
    },
    { key: authCookieName(), value: JSON.stringify(session) },
  )
}

async function mockAdminApis(page: Page) {
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { id: 'admin-user', role: 'admin', email: 'admin@example.com' },
      }),
    })
  })

  await page.route('**/api/v1/counts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { unread_chats: 0, pending_bookings: 0, unread_notifications: 0 },
      }),
    })
  })

  await page.route('**/api/v1/notifications**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { notifications: [], total: 0, page: 1, page_size: 1 },
      }),
    })
  })

  await page.route('**/api/v1/admin/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          total_users: 30,
          pending_cleaners: 1,
          approved_cleaners: 5,
          live_cleaners: 4,
          rejected_cleaners: 2,
          open_disputes: 1,
        },
      }),
    })
  })

  await page.route('**/api/v1/admin/ops-queues', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          pending_cleaner_approvals: { count: 0, items: [] },
          active_disputes: {
            count: 0,
            breakdown: { open: 0, awaiting_response: 0, under_review: 0 },
            items: [],
          },
          pending_booking_requests: { count: 0, items: [] },
          todays_jobs: { count: 0, items: [] },
          upcoming_jobs: {
            today_count: 0,
            tomorrow_count: 0,
            today_items: [],
            tomorrow_items: [],
          },
          payment_failures: { count: 0, items: [] },
          payment_issues: { count: 0, items: [] },
          cancellations_no_shows: {
            count: 3,
            items: [
              {
                id: 'noshow-cleaner',
                category: 'no_show',
                booking_id: '11111111-1111-4111-8111-111111111111',
                status: 'open',
                reason: 'Cleaner did not arrive for the scheduled booking',
                occurred_at: '2026-07-17T14:45:00.000Z',
                label: 'Cleaner no-show',
                severity: 'critical',
                sort_priority: 50,
                lead_time_hours: null,
              },
              {
                id: 'cancel-under-12',
                category: 'cancellation',
                booking_id: '22222222-2222-4222-8222-222222222222',
                status: 'cancelled',
                reason: 'Cancelled by cleaner under 12 hours before scheduled start',
                occurred_at: '2026-07-17T06:31:00.000Z',
                label: 'Cleaner cancellation (<12 hours)',
                severity: 'high',
                sort_priority: 30,
                lead_time_hours: 7.98,
              },
              {
                id: 'cancel-between-12-24',
                category: 'cancellation',
                booking_id: '33333333-3333-4333-8333-333333333333',
                status: 'cancelled',
                reason: 'Cancelled by cleaner within the 12-24 hour policy band',
                occurred_at: '2026-07-16T22:56:00.000Z',
                label: 'Cleaner cancellation (12-24 hours)',
                severity: 'medium',
                sort_priority: 20,
                lead_time_hours: 15.57,
              },
            ],
          },
          generated_at: now,
        },
      }),
    })
  })

  await page.route('**/api/v1/admin/cleaners**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          cleaners: [
            {
              id: 'cleaner-1',
              user_id: 'cleaner-user-1',
              user_name: 'Responsive Admin Cleaner',
              user_email: 'responsive.cleaner@example.com',
              user_phone: '+357 99 123456',
              bio: 'Cleaner profile used for responsive checks.',
              skills: ['One-off clean'],
              cleaning_supplies: 'own_supplies',
              years_experience: 3,
              hourly_rate: 15,
              transport_mode: 'own_car',
              id_type: 'passport',
              id_file_name: 'passport.pdf',
              profile_image_url: null,
              status: 'pending',
              lifecycle_status: 'pending_approval',
              profile_complete: true,
              identity_verified: true,
              cleaning_standards_accepted: true,
              standards_completed: true,
              quiz_passed: true,
              quiz_score: 95,
              stripe_onboarding_complete: false,
              trial_period_flag: true,
              total_jobs: 6,
              average_rating: 5,
              reliability: {
                is_super_cleaner: false,
                completed_released_count: 6,
                average_rating: 5,
                cancellation_rate: 0.111,
                cancellation_numerator: 1,
                cancellation_denominator: 9,
                last_minute_incidents_30d: 0,
                no_shows_60d: 0,
                verified_job_count: 0,
                on_time_rate: null,
                on_time_percentage: null,
                active_strike_count: 0,
                criteria: {
                  completed_bookings: false,
                  average_rating: true,
                  no_no_shows_60d: true,
                  last_minute_incidents_30d: true,
                  cancellation_rate: false,
                  verified_jobs: false,
                  on_time_rate: false,
                  active_strikes: true,
                  cancellation_recovery: true,
                  no_show_recovery: true,
                },
                eligibility_checklist: [
                  {
                    key: 'completed_bookings',
                    label: 'Successfully completed bookings',
                    value: '6 / 20',
                    requirement: '20 required',
                    met: false,
                  },
                  {
                    key: 'average_rating',
                    label: 'Average rating',
                    value: '5.0 / 4.6 required',
                    requirement: '4.6 required',
                    met: true,
                  },
                  {
                    key: 'no_no_shows_60d',
                    label: 'No-shows (last 60 days)',
                    value: '0',
                    requirement: 'Must be 0',
                    met: true,
                  },
                  {
                    key: 'last_minute_incidents_30d',
                    label: 'Last-minute cancellations (last 30 days)',
                    value: '0',
                    requirement: 'Must be fewer than 2',
                    met: true,
                  },
                  {
                    key: 'cancellation_rate',
                    label: 'Cancellation rate',
                    value: '11.1% (must be below 10%)',
                    requirement: 'Must be below 10%',
                    met: false,
                  },
                  {
                    key: 'on_time_rate',
                    label: 'On-time rate',
                    value: 'Not enough verified jobs',
                    requirement: '90.0% required from 10 verified jobs',
                    met: false,
                  },
                  {
                    key: 'active_strikes',
                    label: 'Active strikes',
                    value: '0',
                    requirement: 'Must be 0',
                    met: true,
                  },
                ],
                recovery_cancellation_started_at: null,
                recovery_no_show_started_at: null,
                last_calculated_at: now,
              },
              reliability_incidents: [],
              cancellation_windows: {
                more_than_24h: 0,
                between_12h_24h: 1,
                less_than_12h: 0,
              },
              cancellation_events: [],
              reliability_strikes: [],
              created_at: now,
            },
          ],
          total: 1,
          page: 1,
          page_size: 20,
        },
      }),
    })
  })
}

async function expectNoResponsiveOverflow(page: Page) {
  const documentOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(documentOverflow).toBe(false)

  const overflowing = await page.locator('body *').evaluateAll((nodes) => {
    const viewportWidth = document.documentElement.clientWidth
    const hasScrollableAncestor = (element: HTMLElement) => {
      let current = element.parentElement
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current)
        const canScrollX = ['auto', 'scroll', 'hidden'].includes(style.overflowX)
        if (canScrollX && current.scrollWidth > current.clientWidth + 1) return true
        current = current.parentElement
      }
      return false
    }

    return nodes
      .map((node) => {
        const element = node as HTMLElement
        const tag = element.tagName.toLowerCase()
        if (['svg', 'path'].includes(tag)) return null
        const style = window.getComputedStyle(element)
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.position === 'fixed'
        ) {
          return null
        }
        const rect = element.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return null
        const isIntentionalScrollContainer =
          ['auto', 'scroll', 'hidden'].includes(style.overflowX) &&
          element.scrollWidth > element.clientWidth + 1
        if (isIntentionalScrollContainer) return null

        const text = element.textContent?.trim() ?? ''
        const overflowsViewport = rect.left < -1 || rect.right > viewportWidth + 1
        const overflowsSelf = text.length > 0 && element.scrollWidth > element.clientWidth + 1
        if (overflowsViewport && hasScrollableAncestor(element)) return null
        if (!overflowsViewport && !overflowsSelf) return null
        return {
          tag,
          text: text.slice(0, 80),
          rectRight: Math.round(rect.right),
          viewportWidth,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        }
      })
      .filter(Boolean)
      .slice(0, 8)
  })
  expect(overflowing).toEqual([])
}

test.describe('Admin add-on responsive UI @smoke', () => {
  test.use({ storageState: authStatePath('admin') })

  for (const viewport of VIEWPORTS) {
    test(`Super Cleaner eligibility is responsive on ${viewport.name}`, async ({ page }) => {
      await seedAdminSession(page)
      await mockAdminApis(page)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/admin/cleaners')

      await expect(page.getByText('Responsive Admin Cleaner')).toBeVisible()
      await page.getByText('View eligibility details').click()
      await expect(page.getByText('Super Cleaner eligibility')).toBeVisible()
      await expect(page.getByText('Cancellation rate:')).toBeVisible()
      await expect(page.getByText('Not enough verified jobs')).toBeVisible()

      await expectNoResponsiveOverflow(page)
    })

    test(`Cancellation severity queue is responsive on ${viewport.name}`, async ({ page }) => {
      await seedAdminSession(page)
      await mockAdminApis(page)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/admin/dashboard')

      await expect(page.getByText('Cancellations / No-shows')).toBeVisible()
      await expect(page.getByText('Cleaner no-show')).toBeVisible()
      await expect(page.getByText('Cleaner cancellation (<12 hours)')).toBeVisible()
      await expect(page.getByText('Cleaner cancellation (12-24 hours)')).toBeVisible()

      await expectNoResponsiveOverflow(page)
    })
  }
})
