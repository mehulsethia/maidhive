import { notificationRepo } from '../repositories/notification.repo'

type NotificationInput = {
  userId: string
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
}

export async function pushInAppNotification(input: NotificationInput) {
  try {
    await notificationRepo.create(input)
  } catch (error) {
    console.error('Failed to create in-app notification:', error)
  }
}
