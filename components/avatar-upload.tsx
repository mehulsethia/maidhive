'use client'

import { useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { getAccessToken } from '@/lib/auth-cache'

interface AvatarUploadProps {
  currentUrl?: string | null
  fallbackInitial: string
  size?: 'sm' | 'lg'
  onUploaded: (url: string) => void
}

export function AvatarUpload({ currentUrl, fallbackInitial, size = 'lg', onUploaded }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const displayUrl = previewUrl ?? currentUrl
  const px = size === 'lg' ? 'h-24 w-24' : 'h-16 w-16'
  const textSize = size === 'lg' ? 'text-4xl' : 'text-2xl'

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setPreviewUrl(URL.createObjectURL(file))
    setUploading(true)

    try {
      const token = await getAccessToken()
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''
      const form = new FormData()
      form.append('file', file)

      const res = await fetch(`${BASE}/api/v1/upload/profile-image`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? 'Upload failed')
      }

      onUploaded(json.data.url)
      toast.success('Profile image updated!')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to upload image')
      setPreviewUrl(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="relative inline-block">
      {displayUrl ? (
        <img src={displayUrl} alt="Profile" className={`${px} rounded-full object-cover`} />
      ) : (
        <div className={`${px} grid place-items-center rounded-full bg-primary ${textSize} font-bold text-white`}>
          {fallbackInitial.toUpperCase()}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white border-2 border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50 transition-colors"
      >
        {uploading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
        ) : (
          <Pencil className="h-3.5 w-3.5" />
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}
