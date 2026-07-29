export const MAX_EVIDENCE_IMAGES = 5
export const MAX_EVIDENCE_SIZE_BYTES = 10 * 1024 * 1024
const TARGET_EVIDENCE_UPLOAD_BYTES = 3.5 * 1024 * 1024
const COMPRESSIBLE_EVIDENCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function prepareEvidenceFileForUpload(file: File) {
  if (file.size <= TARGET_EVIDENCE_UPLOAD_BYTES || !COMPRESSIBLE_EVIDENCE_TYPES.has(file.type)) {
    return file
  }
  if (typeof createImageBitmap !== 'function') return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  try {
    let scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height))
    for (const quality of [0.82, 0.72, 0.62]) {
      const blob = await renderEvidenceImage(bitmap, scale, quality)
      if (blob.size <= TARGET_EVIDENCE_UPLOAD_BYTES || quality === 0.62) {
        return blob.size < file.size
          ? new File([blob], withJpegExtension(file.name), { type: 'image/jpeg', lastModified: Date.now() })
          : file
      }
      scale *= 0.82
    }
    return file
  } finally {
    bitmap.close()
  }
}

function withJpegExtension(name: string) {
  const withoutExtension = name.replace(/\.[^.]+$/, '')
  return `${withoutExtension || 'evidence'}.jpg`
}

function renderEvidenceImage(bitmap: ImageBitmap, scale: number, quality: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to prepare image for upload')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Unable to prepare image for upload'))
    }, 'image/jpeg', quality)
  })
}
