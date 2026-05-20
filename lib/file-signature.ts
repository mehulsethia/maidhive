export const IMAGE_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]
export const DOCUMENT_MIME_TYPES: readonly string[] = ['application/pdf', ...IMAGE_MIME_TYPES]

export function matchesFileSignature(bytes: Uint8Array, mime: string) {
  if (mime === 'application/pdf') {
    return (
      bytes.length >= 5 &&
      bytes[0] === 0x25 && // %
      bytes[1] === 0x50 && // P
      bytes[2] === 0x44 && // D
      bytes[3] === 0x46 && // F
      bytes[4] === 0x2d // -
    )
  }

  if (mime === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }

  if (mime === 'image/png') {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    )
  }

  if (mime === 'image/webp') {
    if (bytes.length < 12) return false
    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
    const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
    return riff === 'RIFF' && webp === 'WEBP'
  }

  if (mime === 'image/heic' || mime === 'image/heif') {
    if (bytes.length < 12) return false
    const boxType = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7])
    if (boxType !== 'ftyp') return false
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
    return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)
  }

  return false
}
