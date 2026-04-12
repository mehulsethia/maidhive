import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/auth'
import { db } from '@/server/db'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export const POST = requireAuth(async (req: NextRequest, _ctx, user) => {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 })
  }

  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ success: false, message: 'Only JPEG, PNG, and WebP images allowed' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ success: false, message: 'Image must be under 5MB' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${user.id}/${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabaseAdmin.storage
    .from('profile-images')
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ success: false, message: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabaseAdmin.storage
    .from('profile-images')
    .getPublicUrl(path)

  const publicUrl = urlData.publicUrl

  // Update user avatar
  await db.user.update({
    where: { id: user.id },
    data: { avatarUrl: publicUrl },
  })

  // If cleaner, also update profile_image_url on cleaner record
  if (user.role === 'cleaner') {
    await db.cleaner.updateMany({
      where: { userId: user.id },
      data: { profileImageUrl: publicUrl },
    })
  }

  return NextResponse.json({ success: true, data: { url: publicUrl } })
})
