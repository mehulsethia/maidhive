import { describe, expect, it } from 'vitest'
import { hasAnyRole } from '@/server/lib/rbac'
import { DOCUMENT_MIME_TYPES, IMAGE_MIME_TYPES, matchesFileSignature } from '@/lib/file-signature'

describe('F15 Security boundaries + webhook/upload safeguards unit coverage', () => {
  it('UT-SEC-01 ownership/role guard primitive denies unauthorized roles', () => {
    expect(hasAnyRole('admin', ['admin'])).toBe(true)
    expect(hasAnyRole('cleaner', ['client'])).toBe(false)
    expect(hasAnyRole('client', ['cleaner', 'admin'])).toBe(false)
  })

  it('UT-SEC-02 file signature validator accepts valid jpeg/png/pdf signatures only', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xdb])
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])

    expect(matchesFileSignature(jpeg, 'image/jpeg')).toBe(true)
    expect(matchesFileSignature(png, 'image/png')).toBe(true)
    expect(matchesFileSignature(pdf, 'application/pdf')).toBe(true)
    expect(matchesFileSignature(new Uint8Array([0x01, 0x02, 0x03]), 'image/jpeg')).toBe(false)
  })

  it('UT-SEC-03 unsupported mime signatures fail closed', () => {
    expect(matchesFileSignature(new Uint8Array([0x01, 0x02]), 'application/octet-stream')).toBe(false)
    expect(IMAGE_MIME_TYPES.includes('image/jpeg')).toBe(true)
    expect(DOCUMENT_MIME_TYPES.includes('application/pdf')).toBe(true)
  })
})
