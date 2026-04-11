'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminIndexPage() {
  const router = useRouter()

  useEffect(() => {
    // Layout handles auth — if authed, redirect to dashboard
    router.replace('/admin/dashboard')
  }, [router])

  return null
}
