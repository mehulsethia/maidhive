'use client'

import { toast } from 'sonner'

export function showJobStartedToast(bookingId: string) {
  toast.success('Job started!', {
    id: `job-started:${bookingId}`,
    duration: 2800,
  })
}
