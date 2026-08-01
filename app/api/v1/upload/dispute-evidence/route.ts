import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/auth'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { IMAGE_MIME_TYPES, matchesFileSignature } from '@/lib/file-signature'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const DEFAULT_DISPUTE_EVIDENCE_BUCKET = 'dispute-evidence'
const LEGACY_PROFILE_IMAGE_BUCKET = 'profile-images'
const DISPUTE_EVIDENCE_BUCKET = resolveDisputeEvidenceBucket()
const ALLOWED_MIME = new Set(IMAGE_MIME_TYPES)
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

let bucketEnsured = false

type ParsedUploadFile = {
  name: string
  type: string
  size: number
  bytes: Uint8Array
}

class MultipartParseError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
  }
}

function resolveDisputeEvidenceBucket() {
  const configuredBucket = process.env.SUPABASE_DISPUTE_EVIDENCE_BUCKET?.trim()
  if (!configuredBucket || configuredBucket === LEGACY_PROFILE_IMAGE_BUCKET) {
    return DEFAULT_DISPUTE_EVIDENCE_BUCKET
  }
  return configuredBucket
}

function getMultipartBoundary(contentType: string | null) {
  const match = contentType?.match(/(?:^|;)\s*boundary=(?:"([^"]+)"|([^;]+))/i)
  return match?.[1] ?? match?.[2]?.trim() ?? null
}

function inferMultipartBoundary(body: Buffer) {
  if (!body.subarray(0, 2).equals(Buffer.from('--'))) return null
  const lineEnd = body.indexOf(Buffer.from('\r\n'))
  if (lineEnd <= 2) return null
  const boundary = body.subarray(2, lineEnd).toString('utf8').trim()
  if (!boundary || boundary.includes('\r') || boundary.includes('\n')) return null
  return boundary.endsWith('--') ? boundary.slice(0, -2) : boundary
}

function parseContentDisposition(value: string | undefined) {
  const name = value?.match(/(?:^|;)\s*name="([^"]+)"/i)?.[1] ?? null
  const filename = value?.match(/(?:^|;)\s*filename="([^"]*)"/i)?.[1] ?? null
  return { name, filename }
}

function parsePartHeaders(headerText: string) {
  const headers = new Map<string, string>()
  for (const line of headerText.split('\r\n')) {
    const separator = line.indexOf(':')
    if (separator <= 0) continue
    headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim())
  }
  return headers
}

async function parseMultipartFile(req: NextRequest): Promise<ParsedUploadFile> {
  const contentType = req.headers.get('content-type')
  const body = Buffer.from(await req.arrayBuffer())
  if (body.length === 0) {
    throw new MultipartParseError('Multipart body is empty', 'empty_body')
  }
  const boundary = getMultipartBoundary(contentType) ?? inferMultipartBoundary(body)
  if (!boundary) {
    throw new MultipartParseError('Missing multipart boundary', 'missing_boundary')
  }

  const delimiter = Buffer.from(`--${boundary}`)
  const headerSeparator = Buffer.from('\r\n\r\n')
  const lineBreak = Buffer.from('\r\n')
  let cursor = body.indexOf(delimiter)

  while (cursor !== -1) {
    const partStart = cursor + delimiter.length
    if (body.slice(partStart, partStart + 2).toString('utf8') === '--') break

    const headerStart = body.indexOf(lineBreak, partStart)
    if (headerStart === -1) {
      throw new MultipartParseError('Multipart part is missing header line break', 'missing_part_header')
    }

    const headerEnd = body.indexOf(headerSeparator, headerStart + lineBreak.length)
    if (headerEnd === -1) {
      throw new MultipartParseError('Multipart part is missing header separator', 'missing_header_separator')
    }

    const headers = parsePartHeaders(body.slice(headerStart + lineBreak.length, headerEnd).toString('utf8'))
    const disposition = parseContentDisposition(headers.get('content-disposition'))
    const dataStart = headerEnd + headerSeparator.length
    const nextDelimiter = body.indexOf(Buffer.from(`\r\n--${boundary}`), dataStart)
    if (nextDelimiter === -1) {
      throw new MultipartParseError('Multipart file part is incomplete', 'incomplete_file_part')
    }

    if (disposition.name === 'file') {
      const fileBytes = body.slice(dataStart, nextDelimiter)
      const type = headers.get('content-type') ?? 'application/octet-stream'
      return {
        name: disposition.filename || 'evidence-upload',
        type,
        size: fileBytes.length,
        bytes: new Uint8Array(fileBytes),
      }
    }

    cursor = body.indexOf(delimiter, nextDelimiter)
  }

  throw new MultipartParseError('No file field found in multipart body', 'missing_file')
}

async function updateDisputeBucketPolicy() {
  const { error } = await supabaseAdmin.storage.updateBucket(DISPUTE_EVIDENCE_BUCKET, {
    public: true,
    fileSizeLimit: MAX_UPLOAD_BYTES,
    allowedMimeTypes: Array.from(ALLOWED_MIME),
  })
  if (error) throw error
}

async function ensureDisputeBucketExists() {
  if (bucketEnsured) return

  const { data: existing, error: fetchError } = await supabaseAdmin.storage.getBucket(DISPUTE_EVIDENCE_BUCKET)
  if (!fetchError && existing) {
    await updateDisputeBucketPolicy()
    bucketEnsured = true
    return
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(DISPUTE_EVIDENCE_BUCKET, {
    public: true,
    fileSizeLimit: MAX_UPLOAD_BYTES,
    allowedMimeTypes: Array.from(ALLOWED_MIME),
  })

  if (createError) {
    if (!String(createError.message ?? '').toLowerCase().includes('already exists')) {
      throw createError
    }
    await updateDisputeBucketPolicy()
  }

  bucketEnsured = true
}

export const POST = requireAuth(async (req: NextRequest, _ctx, user) => {
  let file: ParsedUploadFile
  try {
    file = await parseMultipartFile(req)
  } catch (formError) {
    console.error('dispute_evidence.form_data_parse_failed', {
      content_type: req.headers.get('content-type'),
      content_length: req.headers.get('content-length'),
      code: formError instanceof MultipartParseError ? formError.code : 'unknown',
      message: formError instanceof Error ? formError.message : String(formError),
    })
    return NextResponse.json(
      { success: false, message: 'Upload request was malformed. Please reselect the image and try again.' },
      { status: 400 },
    )
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ success: false, message: `${file.name} is not supported. Only JPG, PNG, WebP, and HEIC images are allowed.` }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ success: false, message: `${file.name} must be under 10MB.` }, { status: 400 })
  }

  if (!matchesFileSignature(file.bytes, file.type)) {
    return NextResponse.json({ success: false, message: `${file.name} is not a valid ${file.type || 'image'} file.` }, { status: 400 })
  }
  const ext = EXT_BY_MIME[file.type]
  const path = `disputes/${user.id}/${Date.now()}-${randomUUID()}.${ext}`

  try {
    await ensureDisputeBucketExists()
  } catch (bucketError: any) {
    console.error('dispute_evidence.bucket_init_failed', {
      bucket: DISPUTE_EVIDENCE_BUCKET,
      message: bucketError?.message,
      status: bucketError?.status,
      status_code: bucketError?.statusCode,
      error: bucketError?.error,
    })
    return NextResponse.json(
      { success: false, message: bucketError?.message ?? 'Failed to initialize dispute evidence bucket' },
      { status: 500 },
    )
  }

  const { error: uploadError } = await supabaseAdmin.storage
    .from(DISPUTE_EVIDENCE_BUCKET)
    .upload(path, file.bytes, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('dispute_evidence.upload_failed', {
      bucket: DISPUTE_EVIDENCE_BUCKET,
      content_type: file.type,
      size: file.size,
      name: file.name,
      message: uploadError.message,
      status: (uploadError as any).status,
      status_code: (uploadError as any).statusCode,
      error: (uploadError as any).error,
    })
    return NextResponse.json({ success: false, message: uploadError.message || 'Storage upload failed' }, { status: 500 })
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(DISPUTE_EVIDENCE_BUCKET)
    .getPublicUrl(path)

  return NextResponse.json({ success: true, data: { url: urlData.publicUrl } })
})
