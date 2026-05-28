import { describe, expect, it } from 'vitest'
import { DOCUMENT_MIME_TYPES, IMAGE_MIME_TYPES, matchesFileSignature } from '@/lib/file-signature'

describe('F18 upload validator unit coverage', () => {
  it('UT-UPLOAD-01 accepts valid jpeg/png/webp/pdf signatures', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xdb])
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])

    expect(matchesFileSignature(jpeg, 'image/jpeg')).toBe(true)
    expect(matchesFileSignature(png, 'image/png')).toBe(true)
    expect(matchesFileSignature(pdf, 'application/pdf')).toBe(true)
    expect(matchesFileSignature(webp, 'image/webp')).toBe(true)
  })

  it('UT-UPLOAD-02 rejects invalid payload for claimed mime type', () => {
    const fakeJpeg = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    expect(matchesFileSignature(fakeJpeg, 'image/jpeg')).toBe(false)
  })

  it('UT-UPLOAD-03 allowed mime sets include expected image and document types', () => {
    expect(IMAGE_MIME_TYPES).toContain('image/jpeg')
    expect(IMAGE_MIME_TYPES).toContain('image/png')
    expect(DOCUMENT_MIME_TYPES).toContain('application/pdf')
  })
})
