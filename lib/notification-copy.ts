import type { NotificationRead } from '@/types'

type NotificationRole = 'client' | 'cleaner' | 'admin'

export function normalizeNotificationCopyForRole(
  role: NotificationRole,
  notification: NotificationRead,
): NotificationRead {
  if (role === 'client') {
    const simplifyCompletedStatus = (copy: string) => copy
      .replace(/Completed\s*[-–—]\s*Awaiting Release/gi, 'Completed')
      .replace(/Completed\s*[-–—]\s*Released/gi, 'Completed')

    return {
      ...notification,
      title: simplifyCompletedStatus(String(notification.title ?? '')),
      body: simplifyCompletedStatus(String(notification.body ?? '')),
    }
  }

  if (role === 'cleaner') {
    return {
      ...notification,
      title: String(notification.title ?? '')
        .replace(/Payment Required/gi, 'Awaiting payment authorisation')
        .replace(/New Booking Request/gi, 'New Request'),
      body: String(notification.body ?? '')
        .replace(/Payment Required/gi, 'Awaiting payment authorisation'),
    }
  }

  return notification
}
