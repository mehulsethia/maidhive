import { expect, test } from '@playwright/test'
import { authStatePath } from './auth-state'
import { hasRoleCredentialCandidates } from './helpers'

test.describe('F18 Uploads and document paths @smoke', () => {
  test.setTimeout(120_000)

  test.describe('client session', () => {
    test.use({ storageState: authStatePath('client') })

    test('E2E-UPLOAD-01 booking photo route rejects invalid file type payload', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('client'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const res = await page.request.post('/api/v1/upload/booking-photos', {
        multipart: {
          file: {
            name: 'invalid.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('not-an-image'),
          },
        },
      })
      const body = await res.json()

      expect([400, 409]).toContain(res.status())
      expect(body.success).toBe(false)
    })

    test('E2E-UPLOAD-02 client ID route rejects malformed payload when no file is provided', async ({ page }) => {
      const res = await page.request.post('/api/v1/upload/client-id-document', {
        multipart: {},
      })
      const body = await res.json()

      expect([400, 409]).toContain(res.status())
      expect(body.success).toBe(false)
    })
  })

  test.describe('cleaner session', () => {
    test.use({ storageState: authStatePath('cleaner') })

    test('E2E-UPLOAD-03 cleaner KYC route rejects invalid mime/signature combination', async ({ page }) => {
      test.skip(!hasRoleCredentialCandidates('cleaner'), 'Set at least one E2E_*_EMAIL and E2E_*_PASSWORD pair')

      const res = await page.request.post('/api/v1/upload/kyc-document', {
        multipart: {
          file: {
            name: 'kyc.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('not-a-pdf-or-image'),
          },
        },
      })
      const body = await res.json()

      expect([400, 409]).toContain(res.status())
      expect(body.success).toBe(false)
    })
  })
})
