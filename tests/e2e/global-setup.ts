import fs from 'node:fs/promises'
import path from 'node:path'
import { config as loadDotenv } from 'dotenv'
import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { FullConfig } from '@playwright/test'
import { authDirPath, authStatePath, type E2ERole } from './auth-state'

loadDotenv({ path: '.env.local' })

type Credentials = {
  email: string
  password: string
}

type CookieOptions = {
  domain?: string
  path?: string
  maxAge?: number
  expires?: Date | string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'lax' | 'strict' | 'none'
}

type CookieRecord = {
  name: string
  value: string
  options: CookieOptions
}

type CookieInput = {
  name: string
  value: string
  options?: CookieOptions
}

type StorageStateCookie = {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly: boolean
  secure: boolean
  sameSite: 'Lax' | 'Strict' | 'None'
}

function getEnvCredentials(role: E2ERole): Credentials | null {
  const upper = role.toUpperCase()
  const email = process.env[`E2E_${upper}_EMAIL`]
  const password = process.env[`E2E_${upper}_PASSWORD`]
  if (!email || !password) return null
  return { email, password }
}

function dedupeCredentials(list: Credentials[]): Credentials[] {
  const seen = new Set<string>()
  const deduped: Credentials[] = []
  for (const item of list) {
    const key = `${item.email.toLowerCase()}::${item.password}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
  }
  return deduped
}

function normalizeRole(value: unknown): E2ERole | null {
  const role = String(value ?? '').toLowerCase()
  if (role === 'client' || role === 'cleaner' || role === 'admin') return role
  return null
}

async function resolveRoleCredentials(supabaseUrl: string, supabaseAnonKey: string) {
  const preferredRoles: E2ERole[] = ['client', 'cleaner', 'admin']
  const candidates = dedupeCredentials(
    preferredRoles
      .map(getEnvCredentials)
      .filter((item): item is Credentials => Boolean(item)),
  )

  if (candidates.length === 0) {
    throw new Error(
      'No E2E credentials provided. Set E2E_CLIENT_*, E2E_CLEANER_*, and E2E_ADMIN_* env vars.',
    )
  }

  const roleToCreds = new Map<E2ERole, Credentials>()

  for (const creds of candidates) {
    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data, error } = await supabase.auth.signInWithPassword({
      email: creds.email,
      password: creds.password,
    })

    if (error) continue

    const resolvedRole = normalizeRole(data.user?.user_metadata?.role)
    if (resolvedRole && !roleToCreds.has(resolvedRole)) {
      roleToCreds.set(resolvedRole, creds)
    }

    await supabase.auth.signOut()
  }

  const missing = preferredRoles.filter((role) => !roleToCreds.has(role))
  if (missing.length > 0) {
    throw new Error(
      `Unable to resolve credentials for required roles: ${missing.join(', ')}. ` +
        'Check seeded accounts and E2E_* credentials.',
    )
  }

  return roleToCreds
}

function sameSiteForStorage(value: CookieOptions['sameSite']): StorageStateCookie['sameSite'] {
  if (value === 'strict') return 'Strict'
  if (value === 'none') return 'None'
  return 'Lax'
}

function expiresForStorage(options: CookieOptions): number {
  if (typeof options.maxAge === 'number') {
    return Math.floor(Date.now() / 1000) + options.maxAge
  }
  if (options.expires instanceof Date) {
    return Math.floor(options.expires.getTime() / 1000)
  }
  if (typeof options.expires === 'string') {
    const parsed = Date.parse(options.expires)
    if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000)
  }
  return -1
}

async function buildStorageStateForRole(
  creds: Credentials,
  role: E2ERole,
  supabaseUrl: string,
  supabaseAnonKey: string,
  baseUrl: URL,
) {
  const cookieJar = new Map<string, CookieRecord>()

  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
    },
    cookies: {
      getAll() {
        return Array.from(cookieJar.values()).map((item) => ({ name: item.name, value: item.value }))
      },
      setAll(cookiesToSet: CookieInput[]) {
        for (const item of cookiesToSet) {
          cookieJar.set(item.name, {
            name: item.name,
            value: item.value,
            options: { ...(item.options ?? {}) },
          })
        }
      },
    },
  })

  const { data, error } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  })

  if (error || !data.user) {
    throw new Error(
      `Failed creating storageState for role ${role}: ${error?.message ?? 'unknown auth error'}`,
    )
  }

  const actualRole = normalizeRole(data.user.user_metadata?.role)
  if (actualRole !== role) {
    throw new Error(
      `storageState role mismatch for ${creds.email}: expected ${role}, got ${actualRole ?? 'unknown'}`,
    )
  }

  const cookies: StorageStateCookie[] = Array.from(cookieJar.values()).map((item) => ({
    name: item.name,
    value: item.value,
    domain: item.options.domain ?? baseUrl.hostname,
    path: item.options.path ?? '/',
    expires: expiresForStorage(item.options),
    httpOnly: Boolean(item.options.httpOnly),
    secure: item.options.secure ?? baseUrl.protocol === 'https:',
    sameSite: sameSiteForStorage(item.options.sameSite),
  }))

  if (cookies.length === 0) {
    throw new Error(`No auth cookies were written for role ${role}.`)
  }

  const statePath = authStatePath(role)
  await fs.writeFile(statePath, JSON.stringify({ cookies, origins: [] }, null, 2), 'utf8')
}

export default async function globalSetup(config: FullConfig) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const configuredBaseUrl = process.env.E2E_BASE_URL ?? config.projects[0]?.use?.baseURL ?? 'http://localhost:3000'

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY for e2e global setup.')
  }

  const baseUrl = new URL(configuredBaseUrl)
  const authDir = authDirPath()
  await fs.mkdir(authDir, { recursive: true })

  const roleToCreds = await resolveRoleCredentials(supabaseUrl, supabaseAnonKey)

  await Promise.all(
    (['client', 'cleaner', 'admin'] as const).map((role) =>
      buildStorageStateForRole(roleToCreds.get(role) as Credentials, role, supabaseUrl, supabaseAnonKey, baseUrl),
    ),
  )

  const summary = (['client', 'cleaner', 'admin'] as const)
    .map((role) => `${role}:${path.basename(authStatePath(role))}`)
    .join(', ')
  console.log(`[e2e globalSetup] generated storage states -> ${summary}`)
}
