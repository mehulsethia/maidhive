#!/usr/bin/env node

const DEFAULT_RUNS = 1
const DEFAULT_DELAY_MS = 1000

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.E2E_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '',
    secret: process.env.JOBS_SECRET || process.env.CRON_SECRET || '',
    runs: DEFAULT_RUNS,
    delayMs: DEFAULT_DELAY_MS,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i]
    const next = argv[i + 1]
    if (current === '--base-url' && next) {
      args.baseUrl = next
      i += 1
      continue
    }
    if (current === '--secret' && next) {
      args.secret = next
      i += 1
      continue
    }
    if (current === '--runs' && next) {
      const parsed = Number(next)
      args.runs = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_RUNS
      i += 1
      continue
    }
    if (current === '--delay-ms' && next) {
      const parsed = Number(next)
      args.delayMs = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_DELAY_MS
      i += 1
    }
  }

  return args
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.baseUrl) {
    throw new Error('Missing base URL. Set --base-url or NEXT_PUBLIC_APP_URL.')
  }
  if (!args.secret) {
    throw new Error('Missing secret. Set --secret or JOBS_SECRET/CRON_SECRET.')
  }

  const route = `${String(args.baseUrl).replace(/\/+$/, '')}/api/v1/jobs/reconcile`
  console.log(`[reconcile-backfill] target=${route} runs=${args.runs} delayMs=${args.delayMs}`)

  let successCount = 0
  for (let run = 1; run <= args.runs; run += 1) {
    const startedAt = Date.now()
    const res = await fetch(route, {
      method: 'POST',
      headers: {
        'x-jobs-secret': args.secret,
      },
    })

    const requestId = res.headers.get('x-request-id') || 'n/a'
    const body = await res.json().catch(() => ({}))
    const durationMs = Date.now() - startedAt

    if (!res.ok) {
      console.error(`[reconcile-backfill] run=${run} status=${res.status} requestId=${requestId} durationMs=${durationMs}`)
      console.error(body)
      process.exitCode = 1
      break
    }

    successCount += 1
    console.log(`[reconcile-backfill] run=${run} status=${res.status} requestId=${requestId} durationMs=${durationMs}`)
    console.log(JSON.stringify(body?.data ?? body, null, 2))

    if (run < args.runs && args.delayMs > 0) {
      await sleep(args.delayMs)
    }
  }

  console.log(`[reconcile-backfill] completed success=${successCount}/${args.runs}`)
}

main().catch((error) => {
  console.error('[reconcile-backfill] failed', error?.message || error)
  process.exit(1)
})
