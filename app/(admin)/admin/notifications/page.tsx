'use client'

import { NotificationsCenter } from '@/components/notifications-center'

export default function AdminNotificationsPage() {
  return (
    <div className="space-y-6">
      <NotificationsCenter role="admin" />
    </div>
  )
}
