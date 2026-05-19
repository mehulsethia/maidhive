import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from './db'

export type AppRole = 'client' | 'cleaner' | 'admin'

type BootstrapOptions = {
  role?: AppRole
}

export async function bootstrapServerSession(options: BootstrapOptions = {}) {
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

  const { data, error } = await supabase.auth.getUser()
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

  return {
    authUser: data.user,
    appUser,
  }
}
