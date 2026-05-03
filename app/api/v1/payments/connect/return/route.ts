import { NextResponse } from 'next/server'

export function GET() {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return NextResponse.redirect(`${origin}/cleaner/profile?tab=payments&stripe=connected`)
}
