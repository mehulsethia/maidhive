import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/auth'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { matchesFileSignature } from '@/lib/file-signature'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const DISPUTE_EVIDENCE_BUCKET = (process.env.SUPABASE_DISPUTE_EVIDENCE_BUCKET ?? 'dispute-evidence').trim()
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif'])
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

let bucketEnsured = false

async function ensureDisputeBucketExists() {
  if (bucketEnsured) return

  const { data: existing, error: fetchError } = await supabaseAdmin.storage.getBucket(DISPUTE_EVIDENCE_BUCKET)
  if (!fetchError && existing) {
    bucketEnsured = true
    return
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(DISPUTE_EVIDENCE_BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: Array.from(ALLOWED_MIME),
  })

  if (createError && !String(createError.message ?? '').toLowerCase().includes('already exists')) {
    throw createError
  }

  bucketEnsured = true
}

export const POST = requireAuth(async (req: NextRequest, _ctx, user) => {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ success: false, message: 'Only JPG, PNG, and HEIC images are allowed' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ success: false, message: 'Image must be under 10MB' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  if (!matchesFileSignature(new Uint8Array(arrayBuffer), file.type)) {
    return NextResponse.json({ success: false, message: 'Invalid image payload' }, { status: 400 })
  }
  const ext = EXT_BY_MIME[file.type]
  const path = `disputes/${user.id}/${Date.now()}-${randomUUID()}.${ext}`

  try {
    await ensureDisputeBucketExists()
  } catch (bucketError: any) {
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
    return NextResponse.json({ success: false, message: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(DISPUTE_EVIDENCE_BUCKET)
    .getPublicUrl(path)

  return NextResponse.json({ success: true, data: { url: urlData.publicUrl } })
})
