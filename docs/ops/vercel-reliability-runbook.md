# Vercel Reliability Runbook (MaidHive)

Last updated: 2026-05-29

## Scope
Operational checks for Vercel-first reliability: cron execution, reconcile auth, browser consistency diagnostics, and manual backfill.

## Production baseline checks
1. Confirm `vercel.json` contains cron:
`/api/v1/jobs/reconcile` on `*/5 * * * *`.
2. Confirm Vercel Production env has at least one secret configured:
`JOBS_SECRET` or `CRON_SECRET`.
3. Confirm reconcile endpoint auth:
- missing/wrong secret -> `401`
- valid secret -> `200`
4. Confirm reconcile run durations stay below function limit (`maxDuration=60` on route).

## Reconcile telemetry events
Route emits structured logs:
1. `reconcile.run.summary` (success path)
2. `reconcile.alert.run_failures` (summary includes failed operations)
3. `reconcile.alert.missed_window` (gap > two cron intervals)
4. `reconcile.auth.unauthorized`
5. `reconcile.auth.misconfigured`

Persistent heartbeat keys are written into `platform_config`:
1. `reconcile.last_run_at`
2. `reconcile.last_started_at`
3. `reconcile.last_success_at`
4. `reconcile.last_run_duration_ms`
5. `reconcile.last_failure_count`

## Manual backfill / replay
Run reconcile manually for missed windows:

```bash
npm run reconcile:backfill -- --base-url https://maidhive.app --secret "$JOBS_SECRET" --runs 12 --delay-ms 1500
```

Notes:
1. Use `--runs` to process in multiple passes after downtime.
2. Keep `--delay-ms` > 0 to avoid burst contention.
3. Capture `x-request-id` from script output for incident traces.

## Browser consistency diagnostics
Client requests now include `x-client-request-id`.
Server responses include `x-request-id` and `request_id`.

When investigating cross-browser inconsistencies:
1. Compare logs for `/api/v1/bookings` and `/api/v1/counts` using `clientRequestId`, role, and user.
2. Look for:
- `bookings.list.client.empty`
- `bookings.list.cleaner.empty`
- `counts.zero_operational_with_notifications`
3. On UI failure, validate pages show explicit load errors instead of false empty states.

## Alerts to configure in Vercel Observability
1. Missing runs:
Alert when no `reconcile.run.summary` in last 10 minutes.
2. Failures:
Alert when `reconcile.alert.run_failures` count > 0 in 5-minute window.
3. Auth drift:
Alert on `reconcile.auth.misconfigured` or repeated `reconcile.auth.unauthorized`.

## Decision gate to revisit architecture
Revisit backend split or workflow engine only if, for 2+ weeks:
1. Reconcile duration is routinely near limits despite batching.
2. Fan-out/retry orchestration requires durable multi-step job semantics.
3. Reliability SLOs still fail after these controls.
