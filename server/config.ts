import { z } from 'zod'

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_JWT_SECRET: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional().default('whsec_placeholder'),
  STRIPE_CONNECT_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_REDIRECT_URI: z.string().optional().default(''),
  GOOGLE_GEOCODING_API_KEY: z.string().optional().default(''),
  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional().default(''),
  PLATFORM_FEE_PCT: z.coerce.number().default(10),
  CAPTURE_DELAY_HOURS: z.coerce.number().default(0.5),
  PAYOUT_DELAY_HOURS: z.coerce.number().default(0.5),
  DISPUTE_WINDOW_HOURS: z.coerce.number().default(24),
  BOOKING_ACCEPT_TTL_MINUTES: z.coerce.number().default(1440),
  BOOKING_PAY_TTL_MINUTES: z.coerce.number().default(15),
  JOBS_SECRET: z.string().optional().default(''),
  CRON_SECRET: z.string().optional().default(''),
})

export const config = schema.parse(process.env)
