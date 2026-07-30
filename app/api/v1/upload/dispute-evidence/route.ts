import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/auth'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { IMAGE_MIME_TYPES, matchesFileSignature } from '@/lib/file-signature'

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

function resolveDisputeEvidenceBucket() {
  const configuredBucket = process.env.SUPABASE_DISPUTE_EVIDENCE_BUCKET?.trim()
  if (!configuredBucket || configuredBucket === LEGACY_PROFILE_IMAGE_BUCKET) {
    return DEFAULT_DISPUTE_EVIDENCE_BUCKET
  }
  return configuredBucket
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
  let formData: FormData
  try {
    formData = await req.formData()
  } catch (formError) {
    console.error('dispute_evidence.form_data_parse_failed', {
      content_type: req.headers.get('content-type'),
      message: formError instanceof Error ? formError.message : String(formError),
    })
    return NextResponse.json(
      { success: false, message: 'Upload request was malformed. Please reselect the image and try again.' },
      { status: 400 },
    )
  }
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ success: false, message: `${file.name} is not supported. Only JPG, PNG, WebP, and HEIC images are allowed.` }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ success: false, message: `${file.name} must be under 10MB.` }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  if (!matchesFileSignature(new Uint8Array(arrayBuffer), file.type)) {
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
    .upload(path, arrayBuffer, {
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
