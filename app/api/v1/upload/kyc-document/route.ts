import { NextRequest, NextResponse } from 'next/server'
import { requireCleaner } from '@/server/auth'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const KYC_BUCKET = (process.env.SUPABASE_KYC_BUCKET ?? 'cleaner-kyc').trim()
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

let bucketEnsured = false

async function ensureKycBucketExists() {
  if (bucketEnsured) return

  const { data: existing, error: fetchError } = await supabaseAdmin.storage.getBucket(KYC_BUCKET)
  if (!fetchError && existing) {
    bucketEnsured = true
    return
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(KYC_BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: Array.from(ALLOWED_MIME),
  })

  if (createError && !String(createError.message ?? '').toLowerCase().includes('already exists')) {
    throw createError
  }

  bucketEnsured = true
}

export const POST = requireCleaner(async (req: NextRequest, _ctx, user) => {
  const cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner) {
    return NextResponse.json({ success: false, message: 'Cleaner profile not found' }, { status: 404 })
  }
  if (cleaner.profileComplete && cleaner.status !== 'rejected') {
    return NextResponse.json(
      {
        success: false,
        message: 'KYC document cannot be changed after submission unless your application is rejected.',
      },
      { status: 409 },
    )
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { success: false, message: 'Only PDF, JPEG, PNG, and WebP files are allowed' },
      { status: 400 },
    )
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ success: false, message: 'File must be under 10MB' }, { status: 400 })
  }

  const ext = EXT_BY_MIME[file.type] ?? 'bin'
  const path = `${user.id}/${Date.now()}-${randomUUID()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  try {
    await ensureKycBucketExists()
  } catch (bucketError: any) {
    return NextResponse.json(
      { success: false, message: bucketError?.message ?? 'Failed to initialize KYC storage bucket' },
      { status: 500 },
    )
  }

  const { error: uploadError } = await supabaseAdmin.storage
    .from(KYC_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ success: false, message: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(KYC_BUCKET)
    .getPublicUrl(path)

  const publicUrl = urlData.publicUrl

  await cleanerRepo.update(cleaner.id, {
    idFileName: file.name,
    idFileUrl: publicUrl,
  })

  return NextResponse.json({
    success: true,
    data: {
      file_name: file.name,
      url: publicUrl,
    },
  })
})
