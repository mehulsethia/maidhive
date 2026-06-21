# MAIDHIVE Test Strategy

Last updated: 2026-06-21
Source of truth for flow coverage: `docs/testing/flow-matrix.md`

## 1) Goals
1. Prevent regressions in major booking/payment/auth flows.
2. Detect breakages early (push/PR), not after release.
3. Keep tests mapped to product behavior with explicit pass/fail criteria.

## 2) Test Pyramid and Ownership
1. Unit (`tests/unit`):
Fast logic validation for policies, validators, calculators, state helpers.
2. Integration (`tests/integration`):
Route + service + repository behavior with deterministic fixtures/mocks.
3. E2E (`tests/e2e`):
Role-based browser journeys for critical workflows.
4. UAT (`docs/testing/uat-checklists/*`):
Release signoff by human verification on staging.

## 3) Tooling Baseline
1. Type gate:
`npx tsc --noEmit`
2. Unit/integration runner:
`vitest`
3. E2E runner:
`playwright`
4. Current scripts:
`npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npm run test:e2e:smoke`

5. Pre-production regression gate:
`npm run test:preprod`

## 4) CI Gates
1. Push/PR gate (`.github/workflows/preproduction.yml`):
`test-build` runs the complete Vitest suite and production build.
2. Responsive browser gate:
`responsive-smoke` runs authenticated admin, cleaner, and client checks at mobile (390px), tablet (768px), and desktop (1440px) widths.
3. Release gate:
`npm run test:preprod` + UAT signoff for client/cleaner/admin checklists. This command runs all unit/integration tests, the production build/type gate, and authenticated E2E smoke tests.
4. Nightly:
Full regression plus edge/time-boundary scenarios.
5. Repository configuration:
Protect the production branch and require both `test-build` and `responsive-smoke` checks before merge. Configure the Supabase, database, and `E2E_*` repository secrets referenced by the workflow.

## 5) Test ID Contract
1. Keep IDs from the flow matrix unchanged:
`UT-*`, `IT-*`, `E2E-*`, `UAT-*`.
2. Every implemented test title must include the exact ID prefix.
3. PRs touching a flow must reference updated/added test IDs in the PR body.

## 6) Data and Environment Strategy
1. Unit:
No external dependencies; pure functions and schema validation first.
2. Integration:
Use seeded deterministic fixtures with isolated test records.
3. E2E:
Use staging-like environment with stable role accounts:
`client_test`, `cleaner_test`, `admin_test`.
4. Stripe/Supabase dependencies:
Use test mode keys and replay-safe idempotent endpoints.

## 7) Flaky Test Policy
1. `P0` tests cannot be merge-gated by rerun-only success.
2. Two consecutive green runs required after flaky fix.
3. Any flaky `P0` E2E test is temporarily moved out of gate only with a linked issue and owner.

## 8) Rollout Plan (Current Sprint)
1. Implement and stabilize:
`F01`, `F04`, `F05`, `F06`.
2. Convert integration skeletons to executable specs against seeded test DB.
3. Convert E2E `fixme` smoke specs into runnable flows with Playwright fixtures.
4. Keep the pre-production workflow and authenticated role credentials operational.

## 9) Definition of Done per Flow
1. Required layer coverage implemented for target phase.
2. Tests wired into correct CI gate.
3. Passes in 2 consecutive runs.
4. UAT cases documented and executable.
5. Known gaps recorded with owner and due date.
