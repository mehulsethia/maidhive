import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from './db'
import { availabilityRepo } from './repositories/availability.repo'
import { notificationRepo } from './repositories/notification.repo'
import { computeCleanerOnboardingProgress } from './services/cleaner-onboarding.service'
import { isSupabaseInvalidRefreshTokenError } from '@/lib/supabase-auth-errors'

export type AppRole = 'client' | 'cleaner' | 'admin'

export type SessionCounts = {
  unread_chats: number
  pending_bookings: number
  unread_notifications: number
}

export type SessionAppUser = {
  id: string
  email: string
  name: string
  role: AppRole
  phone: string | null
  avatar_url: string | null
}

export type SessionClientProfile = {
  id: string
}

export type SessionCleanerProfile = {
  id: string
  profile_image_url: string | null
  onboarding_completion_pct: number
}

export type InitialSession = {
  authUser: { id: string; email: string | undefined; email_confirmed_at: string | null }
  appUser: SessionAppUser
  counts: SessionCounts
  clientProfile: SessionClientProfile | null
  cleanerProfile: SessionCleanerProfile | null
}

type BootstrapOptions = {
  role?: AppRole
}

async function computeCounts(userId: string, role: AppRole): Promise<SessionCounts> {
  const chatCutoff = new Date(Date.now() - 30 * 60 * 1000)
  const bookingFilter =
    role === 'cleaner' ? { cleaner: { userId } } : role === 'client' ? { client: { userId } } : null

  const unreadChatsPromise = bookingFilter
    ? db.message.count({
        where: {
          isRead: false,
          senderId: { not: userId },
          booking: {
            ...bookingFilter,
            status: { in: ['confirmed', 'in_progress', 'completed', 'disputed'] },
            scheduledEnd: { gte: chatCutoff },
          },
        },
      })
    : Promise.resolve(0)

  let pendingBookingsPromise: Promise<number> = Promise.resolve(0)
  if (role === 'cleaner') {
    pendingBookingsPromise = db.booking.count({
      where: {
        cleaner: { userId },
        status: 'pending',
        payment: {
          is: {
            status: { in: ['authorized', 'captured', 'transferred'] },
          },
        },
      },
    })
  } else if (role === 'client') {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    pendingBookingsPromise = db.booking.count({
      where: {
        client: { userId },
        status: 'accepted',
        acceptedAt: { gte: sevenDaysAgo },
      },
    })
  }

  const unreadNotificationsPromise =
    role === 'admin'
      ? (async () => {
          const adminUsers = await db.user.findMany({
            where: { role: 'admin', isActive: true },
            select: { id: true },
          })
          const adminIds = adminUsers.map((u) => u.id)
          if (adminIds.length === 0) return 0
          return notificationRepo.countUnreadForUsers(adminIds)
        })()
      : notificationRepo.countUnread(userId)

  const [unread_chats, pending_bookings, unread_notifications] = await Promise.all([
    unreadChatsPromise,
    pendingBookingsPromise,
    unreadNotificationsPromise,
  ])

  return { unread_chats, pending_bookings, unread_notifications }
}

export async function bootstrapServerSession(options: BootstrapOptions = {}): Promise<InitialSession> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // no-op in RSC bootstrap path
        },
      },
    },
  )

  let data
  let error
  try {
    const result = await supabase.auth.getUser()
    data = result.data
    error = result.error
  } catch (authError) {
    if (!isSupabaseInvalidRefreshTokenError(authError)) throw authError
    redirect('/login')
  }
  if (error || !data.user) {
    redirect('/login')
  }

  const appUser = await db.user.findUnique({
    where: { id: data.user.id },
  })
  if (!appUser || !appUser.isActive || appUser.deletedAt) {
    redirect('/login')
  }

  if (options.role && appUser.role !== options.role) {
    if (appUser.role === 'cleaner') redirect('/cleaner/dashboard')
    if (appUser.role === 'admin') redirect('/admin/dashboard')
    redirect('/client/dashboard')
  }

  const role = appUser.role as AppRole

  const [counts, clientRow, cleanerRow] = await Promise.all([
    computeCounts(appUser.id, role),
    role === 'client'
      ? db.client.findUnique({ where: { userId: appUser.id }, select: { id: true } })
      : Promise.resolve(null),
    role === 'cleaner'
      ? db.cleaner.findUnique({
          where: { userId: appUser.id },
        })
      : Promise.resolve(null),
  ])

  let cleanerProfile: SessionCleanerProfile | null = null
  if (cleanerRow) {
    const schedules = await availabilityRepo.getSchedule(cleanerRow.id)
    const hasAvailabilitySlots = schedules.some((s) => s.isActive)
    const onboarding = computeCleanerOnboardingProgress({ cleaner: cleanerRow, hasAvailabilitySlots })
    cleanerProfile = {
      id: cleanerRow.id,
      profile_image_url: cleanerRow.profileImageUrl ?? null,
      onboarding_completion_pct: onboarding.completion_pct,
    }
  }

  return {
    authUser: {
      id: data.user.id,
      email: data.user.email,
      email_confirmed_at: data.user.email_confirmed_at ?? null,
    },
    appUser: {
      id: appUser.id,
      email: appUser.email,
      name: appUser.name ?? '',
      role,
      phone: appUser.phone ?? null,
      avatar_url: appUser.avatarUrl ?? null,
    },
    counts,
    clientProfile: clientRow ? { id: clientRow.id } : null,
    cleanerProfile,
  }
}
