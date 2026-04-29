import { NextRequest, NextResponse } from 'next/server'
import { requireClient } from '@/server/auth'
import { clientRepo } from '@/server/repositories/client.repo'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { DOCUMENT_MIME_TYPES, matchesFileSignature } from '@/lib/file-signature'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const CLIENT_ID_BUCKET = (process.env.SUPABASE_CLIENT_ID_BUCKET ?? 'client-ids').trim()
const ALLOWED_MIME = new Set(DOCUMENT_MIME_TYPES)
const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

let bucketEnsured = false

async function ensureBucketExists() {
  if (bucketEnsured) return
  const { data: existing, error: fetchError } = await supabaseAdmin.storage.getBucket(CLIENT_ID_BUCKET)
  if (!fetchError && existing) {
    bucketEnsured = true
    return
  }
  const { error: createError } = await supabaseAdmin.storage.createBucket(CLIENT_ID_BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: Array.from(ALLOWED_MIME),
  })
  if (createError && !String(createError.message ?? '').toLowerCase().includes('already exists')) {
    throw createError
  }
  bucketEnsured = true
}

export const POST = requireClient(async (req: NextRequest, _ctx, user) => {
  const client = await clientRepo.findByUserId(user.id)
  if (!client) {
    return NextResponse.json({ success: false, message: 'Client profile not found' }, { status: 404 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 })
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ success: false, message: 'Only PDF, JPEG, PNG, and WebP files are allowed' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ success: false, message: 'File must be under 10MB' }, { status: 400 })
  }

  const ext = EXT_BY_MIME[file.type] ?? 'bin'
  const path = `${user.id}/${Date.now()}-${randomUUID()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()
  if (!matchesFileSignature(new Uint8Array(arrayBuffer), file.type)) {
    return NextResponse.json({ success: false, message: 'Invalid file payload' }, { status: 400 })
  }

  try {
    await ensureBucketExists()
  } catch (bucketError: any) {
    return NextResponse.json(
      { success: false, message: bucketError?.message ?? 'Failed to initialize client ID storage bucket' },
      { status: 500 },
    )
  }

  const { error: uploadError } = await supabaseAdmin.storage.from(CLIENT_ID_BUCKET).upload(path, arrayBuffer, {
    contentType: file.type,
    upsert: true,
  })
  if (uploadError) {
    return NextResponse.json({ success: false, message: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabaseAdmin.storage.from(CLIENT_ID_BUCKET).getPublicUrl(path)
  const publicUrl = urlData.publicUrl

  await clientRepo.update(client.id, {
    idFileName: file.name,
    idFileUrl: publicUrl,
    idSubmittedAt: new Date(),
  })

  return NextResponse.json({
    success: true,
    data: { file_name: file.name, url: publicUrl },
  })
})
