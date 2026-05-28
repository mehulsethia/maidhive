import { expect, test } from '@playwright/test'
import { hasRoleCredentialCandidates, loginAsRole } from './helpers'

test.describe('F01 Auth + RBAC @smoke', () => {
  test('E2E-AUTH-01 client login lands on client dashboard and admin routes are blocked', async ({ page }) => {
    test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

    await loginAsRole(page, 'client')
    await expect(page).toHaveURL(/\/client\/dashboard/)

    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/client\/dashboard/)
  })

  test('E2E-AUTH-02 cleaner login lands on cleaner dashboard and client-only action is blocked', async ({ page }) => {
    test.skip(!hasRoleCredentialCandidates('cleaner'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

    await loginAsRole(page, 'cleaner')
    await expect(page).toHaveURL(/\/cleaner\/dashboard|\/cleaner\/onboarding/)

    await page.goto('/client/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/cleaner\/dashboard|\/cleaner\/onboarding/)
  })

  test('E2E-AUTH-03 admin login lands on admin dashboard and admin views are accessible', async ({ page }) => {
    test.skip(!hasRoleCredentialCandidates('admin'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

    await loginAsRole(page, 'admin')
    await expect(page).toHaveURL(/\/admin\/dashboard/)
    await expect(page.getByText('Admin Control Center')).toBeVisible()

    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/admin\/users/)
  })

  test('E2E-AUTH-04 session refresh retains protected access', async ({ page }) => {
    test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

    await loginAsRole(page, 'client')
    await expect(page).toHaveURL(/\/client\/dashboard/)

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/client\/dashboard/)
    await expect(page.getByRole('link', { name: 'Open Bookings' })).toBeVisible()
  })
})
