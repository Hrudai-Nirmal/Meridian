# Production Incident Response

Use this runbook when sign-in, polling, or other database-backed behavior fails in production.

## First Checks

1. Open `https://meridian.hrudainirmal.in/api/health`.
2. Confirm the deployed `build.commitSha` and inspect `checks` plus `issues`.
3. Copy any `incidentId`; it is safe to share internally and contains no credential data.
4. Query Vercel runtime logs:

```bash
vercel logs meridian.hrudainirmal.in --since 1h --level error --json --scope hrudais-projects-b520d79c
```

Search for the incident ID or structured `event` field. Logs deliberately omit raw database URLs, OAuth payloads, tokens, cookies, passwords, and stack traces.

## Database Incidents

- `DATABASE_UNREACHABLE`: Check Neon status, organization usage, compute availability, and network-transfer quota.
- `DATABASE_AUTH_FAILED`: Rotate Neon credentials through Vercel, then redeploy so Functions receive the new values.
- `DATABASE_SCHEMA_MISMATCH`: Run `npm run prisma:deploy` against the intended database before redeploying.
- `DATABASE_NOT_CONFIGURED`: Restore the Neon Vercel integration or `DATABASE_URL` environment variable.

Meridian prefers Vercel Neon's managed `NeonDB_POSTGRES_PRISMA_URL` and falls back to `DATABASE_URL`. Never paste connection strings into logs or tickets.

## Authentication Incidents

GitHub OAuth requires both a working provider configuration and a writable database session. The login page checks `/api/health` before enabling OAuth. If persistence is unavailable, sign-in stays disabled and displays a correlated incident ID instead of redirecting repeatedly.

## Notification Queue Recovery

1. Confirm `/api/health` reports `checks.jobs: true`.
2. Open `Testing` -> `Notification jobs` and inspect queued, retrying, and failed counts.
3. Check Inngest for `process-notification-job` and `recover-queued-notifications` runs.
4. If credentials were unavailable, restore `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`, redeploy, and manually sync `/api/inngest`; the one-minute sweep recovers queued database jobs.
5. Retry terminal failures only after fixing the provider. Cancel only queued/retrying work that should no longer be delivered.

Inngest events contain job ids and generations only. Never paste provider keys, webhook URLs, signing secrets, or message payloads into incident records.

## Release Gate

Run the manual GitHub Actions `Production smoke` workflow after every production deployment. It sets `SMOKE_REQUIRE_READY=1` and fails when database or authentication readiness is false, or when GitHub sign-in cannot begin.

## June 2026 Incident

The June 19 callback outage was caused by the Neon Free plan network-transfer allowance being exhausted at 5.96 GB during the Jun 1–Jul 1 billing period. The database remained intact but refused application sessions until quota recovery or plan upgrade.
