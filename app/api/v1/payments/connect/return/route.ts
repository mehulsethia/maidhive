import { NextResponse } from 'next/server'

export function GET() {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const nextPath = '/cleaner/profile?tab=payments&stripe=connected'
  return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(nextPath)}`)
}
