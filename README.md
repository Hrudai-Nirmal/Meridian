# Meridian

Meridian is the AI automation control room for agencies and teams. Projects open to a graph-first automation map; selecting a node shows health, API metadata, alerts, recent runs, cost, latency, token usage, and quality signals so teams can prove whether automations are reliable and worth running.

The public root route is signed-out friendly: healthy signed-out visitors see a polished Meridian dark-theme homepage with product positioning, a cursor-reactive DotField hero, a simple centered fixed header, lilac section headings, an oversized scroll-triggered stroke animation for the hero `Meridian` wordmark, Automation Map/client proof visuals, integrations, reliability proof, liquid-glass surfaces, a bottom 5vh blur fade, border glow reserved for the Automation Map visual, integration beam panel, pricing cards, and login card, high-contrast pricing CTAs, and the reusable GitHub/Google/email auth panel. Public conversion paths include `View demo workflow`, `See client proof example`, a three-step "How Meridian works" section, and a static client-proof report preview. The public Automation Map preview starts interaction-paused so page scrolling stays smooth; visitors can click `Enable graph interaction` before dragging or zooming the map. Authenticated users still enter the app directly at `/`, and the dashboard defaults to the Automation Map unless the first-workflow tutorial auto-starts and routes them to a guided setup step. The legacy standalone sign-in screen is also forced dark-mode only.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui
- Auth.js with GitHub OAuth and Prisma adapter
- Prisma + Neon Postgres
- React Flow for project maps
- Apache ECharts for dashboard visualizations

## Environment

Set these values in Vercel for the deployed app:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/meridian?sslmode=require"
NEXTAUTH_URL="https://meridian.hrudainirmal.in"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
ENCRYPTION_KEY="replace-with-a-long-random-encryption-key"
GITHUB_ID="replace-with-github-oauth-client-id"
GITHUB_SECRET="replace-with-github-oauth-client-secret"
CRON_SECRET="replace-with-a-long-random-cron-secret"
RESEND_API_KEY="optional-resend-api-key-for-alert-email"
ALERT_FROM_EMAIL="Meridian <alerts@meridian.hrudainirmal.in>"
INNGEST_EVENT_KEY="replace-with-production-inngest-event-key"
INNGEST_SIGNING_KEY="signkey-prod-replace-with-inngest-signing-key"
```

Meridian production uses the independently managed Neon project `Meridian` through the server-only `DATABASE_URL`. The Prisma client still supports an integration-managed `NeonDB_POSTGRES_PRISMA_URL` when present, but that variable must not remain configured after an independent-database cutover because it takes precedence. Database and authentication failures emit structured, secret-safe runtime logs with incident IDs; `/api/health` returns matching safe issue metadata, and the login screen blocks OAuth while session persistence is unavailable.

Production diagnosis and recovery steps live in `docs/incident-response.md`.

GitHub OAuth callback URL:

```text
https://meridian.hrudainirmal.in/api/auth/callback/github
```

## Vercel Deployment

The production build runs Prisma generation before Next.js:

```bash
npm run build
```

Run production migrations with:

```bash
npm run prisma:deploy
```

Meridian has no Vercel cron schedule by default. The secured `/api/cron/poll` route remains available for explicit schedulers, but production polling is manual unless an active pilot needs REST metric monitoring. A high-frequency scheduler can be one Meridian-owned cron-job.org job that calls the same route every minute when active production metric polling is needed. Every-minute cron keeps the database compute warm and should stay disabled during idle/private-beta cost-control periods. The route requires `CRON_SECRET` and accepts either:

- `Authorization: Bearer <CRON_SECRET>`
- HTTP Basic auth with username `meridian-cron` and password `<CRON_SECRET>`

cron-job.org setup:

```text
Title: Meridian production poll
URL: https://meridian.hrudainirmal.in/api/cron/poll
Schedule: every minute
Method: GET
HTTP auth username: meridian-cron
HTTP auth password: production CRON_SECRET
```

After creating the job, run a manual test execution in cron-job.org and expect HTTP 200 with `ok: true` and `mode: "secured-cron"`. The scheduler checks every minute, but each endpoint is claimed only when its configured cadence is due; an idle tick returns `status: "SKIPPED"` without adding poll history. It can still wake Neon compute, so keep cron-job.org disabled when no pilots require continuous metric polling. Then confirm Testing and `/api/health` show updated latest completed poll metadata.

The deployed app exposes `/api/health` for safe readiness checks. It returns booleans and poll metadata only; it must never return secret values.

Owners/admins can send a harmless test alert email from Testing after `RESEND_API_KEY` and `ALERT_FROM_EMAIL` are configured. Delivery attempts are logged per recipient with status, provider, timestamps, and safe failure summaries.

Owners/admins can also run a project poll manually from Testing for demos. The public `/api/demo/metric` route returns a deterministic sample for private-beta alert QA.

The dashboard information architecture keeps Settings configuration-only: notification preferences, telemetry tokens, and project environment context. Integrations owns setup for telemetry providers, generic alert webhooks, native Slack destinations, and safe remediation actions. Testing owns deployment readiness, manual poll, test email, webhook/Slack/action tests, integration readiness, endpoint setup shortcuts, and demo metric QA. Logs provides a unified safe project timeline with 24h/7d/30d/All windows, type filters, search, and entries from audit activity, alerts, polling, deliveries, runs, reports, webhooks, Slack, remediation actions, team actions, and map changes.

When a main dashboard section is selected, the sidebar switches to contextual mode: the active section heading acts as a back button and one-level subsection anchors appear below it. Back returns to the main section list without changing the active page.

The header search opens Meridian's project-scoped command palette. Click the search control, press `Cmd/Ctrl+K`, or press `/` outside text fields to find sections, nodes, alerts, runs, reports, integrations, recent notification jobs, and common actions such as creating telemetry tokens, opening Dify setup, running a manual poll, creating reports, testing Slack, and opening failed-job logs. Results are built from safe dashboard state only and must never include raw tokens, webhook/Slack URLs, signing secrets, encrypted payloads, or environment values.

Owners/admins can create secure client-facing report links from the dashboard. Report links render a read-only project summary with uptime, run volume, success rate, cost, token usage, active alerts, quality score, node summaries, optional brand imagery, map imagery, previous-period comparison metrics, and a client-facing incident timeline. Links can expire and can be revoked.

The Reports section includes an in-app report preview, reusable report presets, minimal client/agency customization fields, selectable reporting periods, optional PNG/SVG brand image upload, manual map PNG attachment, browser print/save-as-PDF support, and owner/admin CSV exports for runs, metric samples, and alerts. Periods support 7d, 30d, 90d, all data, or custom start/end dates. Previous-period comparison is available for bounded periods and is disabled for all-data reports. Public reports show tone-aware comparison badges, a copyable plain-language client summary, and filterable incident timeline views for all, active, and resolved incidents. Brand images are capped at 256KB and map images are capped at 2MB. CSV exports default to a bounded 30-day window with a 5,000-row default cap and 10,000-row hard cap; response headers report row count, row limit, and truncation. Exports and public reports never include API credentials, ingestion tokens, encrypted secrets, or private team/member details.

Automation Map nodes include visible input and output connection handles. In view mode the handles are visible but locked; in `Edit mode`, drag from a node's right output handle to another node's left input handle to create an autosaved visual workflow link. Click a link to open its label editor, then rename the workflow handoff while Edit mode is on. Self-links and duplicate source-to-target links are blocked.

Client report flow:

1. Open `Reports`.
2. Optionally load an existing preset, or fill report title, client name, subtitle, prepared-by, executive note, and expiry window.
3. Choose a report period: 7d, 30d, 90d, all data, or custom start/end dates.
4. Toggle previous-period comparison for bounded periods when client context needs trend direction.
5. Upload an optional PNG/SVG brand image for the report header.
6. Click `Save preset` if these defaults should be reused later.
7. Click `Attach current map` to store the current Automation Map PNG with the next report link.
8. Confirm the in-app preview shows the period, comparison setting, brand image, summary metrics, and attached map.
9. Click `Create link`, then open the public report link in a signed-out browser.
10. Use `Print / Save PDF` on the public report page for a browser-generated PDF.

Attached maps are served through `/reports/[shareToken]/map.png`; attached brand images are served through `/reports/[shareToken]/brand-image`. Expired or revoked report links return `404` for the report page and attached image routes.

Authenticated dashboards can connect to `/api/projects/[projectId]/events` for lightweight live updates after an operator clicks `Go live`. The default dashboard state is manual refresh to avoid idle Neon queries. The SSE stream only sends safe project-scoped metadata such as cursors and changed areas, checks for changes at a bounded interval, closes while the browser tab is hidden, and auto-pauses after a bounded session. The client refreshes the existing project payload only after a change. If the stream disconnects, the dashboard shows a reconnecting/manual state and the existing refresh controls remain available.

The dashboard header and Control Room show the live stream state, `Go live` / `Pause live`, last checked time, latest changed areas, and a manual `Refresh telemetry now` fallback. Use this to verify whether new runs, polling changes, and alert updates are arriving through the live signal path or need manual refresh.

Control Room also includes Interactive Tutorial v2 for the first REST metric setup path. It auto-starts once per browser for projects with no real runs or metric samples, keeps the page undimmed/clickable, highlights the actual target component, and guides users through node creation, REST metric setup, manual polling, metric evidence, and client proof. The tutorial widget starts bottom-center, can be dragged to snap to an edge/corner, and can collapse to a compact `Show tutorial ^` tab. Navigation steps complete when visited; evidence steps use real persisted data, so sample fallback rows never count as proof. Tutorial completion and widget preferences are stored locally; no database migration is required.

Control Room also includes a pilot setup checklist for the first production-style workflow. It tracks project selection, node creation, integration setup, first real run/metric evidence, alert-rule setup, and client-proof report creation. The checklist uses persisted telemetry evidence only, never seeded sample fallback rows. New users also see a `Create your first monitored workflow` activation card with starter choices for Dify workflow, n8n workflow, JavaScript SDK, GitHub Actions, and REST metric. The card routes users to the Automation Map and Integrations, where owners/admins can create a one-time token and use `Send test telemetry` to make Meridian show real run evidence quickly. `Copy setup packet` copies safe project/node setup details and SDK install guidance without raw tokens or secrets. Header sign-out was moved into the dedicated Account section, which also shows signed-in identity, organization, project context, and links to Team and Settings.

Owners/admins can create project-scoped workflow telemetry tokens from Deployment diagnostics. The raw token is shown once, then only its prefix/hash metadata is retained. External automations can post run telemetry with:

```bash
curl -X POST "https://meridian.hrudainirmal.in/api/ingest/runs" \
  -H "Authorization: Bearer <ingestion-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": "endpoint-node-id",
    "externalId": "run_001",
    "status": "success",
    "startedAt": "2026-06-12T09:30:00.000Z",
    "finishedAt": "2026-06-12T09:30:02.400Z",
    "costUsd": 0.042,
    "tokens": 1280,
    "steps": [
      { "name": "Fetch context", "status": "success", "latencyMs": 420, "toolName": "database" },
      { "name": "Generate response", "status": "success", "latencyMs": 1700, "toolName": "llm" }
    ]
  }'
```

The node inspector includes Basic and Advanced integration templates for Dify, n8n, GitHub Actions, JavaScript SDK telemetry, and OpenAI/custom REST metrics. Basic templates explain the setup path and Advanced templates provide copyable snippets that use the selected node id and `<ingestion-token>` placeholders. The Integrations section also provides a guided setup wizard and provider first-signal card: select a node and provider, create a one-time provider-named ingestion token, copy provider-specific setup blocks, send a harmless synthetic test run for telemetry integrations, check connection evidence, and refresh readiness from existing runs, samples, mappings, and alert rules.

The reusable live workflow demo in `examples/live-workflow` installs the published `@meridian-workflows/sdk` package and simulates a Support Triage Agent with success, degraded, and failed modes. Use it with a disposable Meridian ingestion token to validate the full live telemetry loop from a local Node.js workflow into Runs, Logs, and the live dashboard refresh path.

The Dify demo recipe in `examples/dify-support-triage` builds the same support-triage loop inside Dify with a User Input node, LLM node, Code node, and HTTP Request node that posts to `/api/ingest/runs`. Use the guide with a disposable Meridian ingestion token and selected node id when validating Dify onboarding.

The in-app Dify wizard shows the Code node Python, HTTP Request settings, node id input guidance, token-safety reminders, and connection verification flow directly inside Integrations so beta users do not need external instructions for the first successful run.

Alert rules support guided templates for both API metric samples and workflow-run telemetry. Metric templates prefill static thresholds or anomaly baselines for saved mappings such as latency, score, cost, tokens, queue depth, and custom API metrics. Anomaly rules learn from the previous 7 days of metric samples, require at least 8 prior samples, and fire when the next value is more than 2 standard deviations outside the selected direction. Run templates evaluate after `/api/ingest/runs` persists a workflow run and can alert on failed/degraded status, duration, cost, tokens, failure rate over recent runs, or average latency over recent runs. Each rule has a repeat-suppression window, defaulting to 60 minutes, so matching breaches group onto the same incident with an updated last-seen timestamp and occurrence count instead of creating duplicate unresolved rows. Metric polling ignores run-source rules, and run ingestion ignores metric-source rules, while both paths share the same grouped-incident prevention and durable notification job queueing.

Project editors can create outbound webhook destinations from `Integrations`; owners/admins test them from `Testing`. Meridian queues `alert.opened`, `alert.resolved`, and `webhook.test` JSON payloads for enabled destinations, retries through durable jobs, and records delivery status in alert details and Logs. Signing secrets are shown once at creation and are not exposed again.

Webhook receivers can verify these headers:

```text
X-Meridian-Event: alert.opened | alert.resolved | webhook.test
X-Meridian-Delivery: delivery UUID
X-Meridian-Timestamp: ISO timestamp
X-Meridian-Signature: sha256=<hmac>
```

The signature is HMAC SHA-256 over `timestamp.rawJsonBody` using the destination signing secret.

During the rename transition, webhook deliveries also include the deprecated `X-ArgusGrid-*` header aliases and an `argusgrid` payload metadata alias. Ingestion accepts both `X-Meridian-Token` and the deprecated `X-ArgusGrid-Token`; bearer authentication is unchanged. New integrations should use Meridian names.

Native Slack alert destinations also live in `Integrations`, using Slack incoming webhook URLs. Create a Slack destination with a friendly name, a `https://hooks.slack.com/...` incoming webhook URL, minimum severity, and event filters for `alert.opened`, `alert.resolved`, and `slack.test`. The webhook URL is encrypted, write-only, and never returned to the browser after creation. Meridian queues Slack Block Kit messages for matching enabled destinations, retries through durable jobs, and records delivery evidence in alert details and Logs.

Safe remediation actions live in `Integrations` -> `Remediation actions`. Owners/admins can configure a signed HTTPS runbook endpoint for action types such as pause service, disable intake, scale worker down, trigger rollback, or custom webhook. Each action has manual approval or automatic-on-alert mode, minimum severity, event filters, and a cooldown window. Automatic mode is opt-in and only runs for newly opened incidents after the alert is committed; grouped repeat incidents do not retrigger actions during the same unresolved incident. `Testing` can send a dry-run `remediation.test`, alert details can run enabled manual actions against the selected incident, and Logs has an `Actions` filter for safe attempt evidence. Action URLs and signing secrets are never shown in Logs or alert detail; the one-time signing secret is shown only at creation.

Remediation action receivers should verify:

```text
X-Meridian-Action: alert.opened | remediation.test
X-Meridian-Delivery: remediation_<uuid>
X-Meridian-Timestamp: <ISO timestamp>
X-Meridian-Signature: sha256=<hmac_sha256(timestamp + "." + raw_json_body)>
```

The payload includes safe project, action, node/rule, and alert metadata plus `dryRun: true` for test events. It must never include ingestion tokens, API credentials, Slack/webhook URLs, encrypted payloads, raw env values, or payment credentials.

## Durable Notification Jobs

Alert email, generic webhook, and Slack delivery run through a Postgres-backed outbox and Inngest. Meridian writes one job per recipient/destination in the same transaction as the alert lifecycle change, then sends Inngest only the job id and generation. Direct Inngest job events still process immediately when dispatch succeeds, retry five total attempts with backoff, and retain terminal state for 30 days. Resend receives a stable idempotency key; signed webhooks retain a stable delivery id. Slack is at-least-once when a timeout makes the remote outcome unknowable. Scheduled notification recovery is off by default; owners/admins can click `Recover queued jobs now` in Testing, or set `MERIDIAN_BACKGROUND_RECOVERY_MODE=minimal` for a 6-hour sweep or `full` for a 15-minute sweep during active pilots. Retention cleanup is manual by default through `Run retention cleanup now`; set `MERIDIAN_RETENTION_CLEANUP_MODE=weekly` or `daily` only when continuous cleanup is worth the idle Inngest executions. Raw workflow runs and metric samples default to 90 days, terminal jobs to 30 days, notification deliveries and poll executions to 90 days, audit logs to 365 days, and rate-limit buckets to 2 days.

## Enterprise Usage Guardrails

Workflow ingestion is protected by durable Postgres minute buckets: each ingestion token allows 60 accepted attempts per minute and each project allows 300 attempts per minute. Over-limit requests return `429` with a `Retry-After` header and a secret-safe message. Testing -> Project usage shows 30-day counts for workflow runs, metric samples, alerts, notification jobs/deliveries, report shares, active ingestion tokens, current rate limits, and retention policy summaries.

## Billing And Account Management

Billing is a dedicated sidebar section for beta pricing, recurring monthly subscriptions, prepaid credits, project usage graphs, billing history, invoice downloads, and the project operations policy. The first beta scheme is intentionally conservative: Free Sandbox is $0 / INR 0, Solo Beta is $59 / INR 4,999, Agency Beta is $179 / INR 14,999, and Enterprise Pilot is $799 / INR 64,999. Prepaid credit packs are 500 credits for $19 / INR 1,599, 2,000 credits for $69 / INR 5,999, and 10,000 credits for $249 / INR 20,999. The Billing UI is provider-neutral for customers: paid-plan buttons are labeled `Upgrade to Solo Beta`, `Upgrade to Agency Beta`, and `Upgrade to Enterprise Pilot`; credit-pack buttons are labeled `Buy 500 credits`, `Buy 2,000 credits`, and `Buy 10,000 credits`; status refresh is labeled `Refresh status`.

Billing -> Usage graphs loads live bounded 30-day snapshots for nodes, workflow runs, metric samples, notification jobs, report links, and active telemetry tokens whenever Billing opens or the user clicks Refresh usage. Billing -> Operations Policy lets owners/admins choose the customer-facing posture for operations mode, polling frequency, notification recovery, retention, and spend protection for the current project only. Operations Policy Enforcement now applies project polling cadence, manual retention cleanup windows, and spend behavior: scheduled REST metric polling cannot run more frequently than the effective project cadence, manual retention cleanup uses the selected project retention window for high-volume evidence, `stop_at_plan` blocks overage writes, and `use_credits` records prepaid-credit consumption with safe Billing log evidence. Notification recovery remains bounded by Meridian's central zero-idle infrastructure settings so one project cannot create unbounded idle Inngest cost.

Billing uses Paddle overlay checkout internally for paid plan and credit-pack purchases. The frontend loads `https://cdn.paddle.com/paddle/v2/paddle.js`, initializes Paddle.js with the browser-safe `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, sets sandbox mode when `NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox`, then opens checkout with the configured `NEXT_PUBLIC_PADDLE_PRICE_*` price ID. Paddle client-side tokens and price IDs are safe to expose; do not add a server Paddle API key to browser code. Server-side fulfillment is webhook-backed through `POST /api/paddle/webhook`, which verifies the raw request with the configured Paddle notification secret before mirroring safe customer, subscription, transaction, and credit-ledger state into Postgres. Billing shows mirrored subscription state, a separate transaction history, invoice download links, credit ledger activity, low-credit/rate-limit warnings, and a `Manage subscription` action that mints a short-lived customer portal URL for owners/admins.

Billing -> Subscription management includes `Billing sync health`, a provider-neutral support card for payment confirmation state. It shows whether checkout, signed confirmation, and account portal configuration are present; the latest signed confirmation type/timestamp/status for the current project or organization; and a bounded count of recent failed confirmations. If a customer reports payment completion without access, click `Refresh status`, confirm the card is healthy or waiting, check Billing history for the transaction, and only use verified mirrored records or provisional transaction evidence when adjusting access. Owners/admins can click `Copy support packet` to copy a `Billing support packet` with plan, entitlement source, sync state, current usage, credits, warnings, and recent safe billing denial/credit events. The card and packet must never show Paddle API keys, notification secrets, raw provider payloads, payment credentials, webhook URLs, raw tokens, or environment values.

Billing notifications appear in the `Billing alerts` panel. The panel uses the same server-side entitlement summary as enforcement and warns about low credits, exhausted credits, plan usage above 80%, plan limits reached, past-due payment state, subscription grace ending, and recent ingestion rate-limit hits. Email billing alerts follow existing email notification preferences for v1: owners, admins, and members with email notifications enabled receive durable email jobs for blocked usage and rate-limit events. These jobs are internal support notifications and do not consume customer credits. They are visible through notification-job evidence and must never expose provider keys, payment credentials, webhook URLs, raw ingestion tokens, or environment values.

Billing entitlements are derived only from verified server-side Paddle evidence, never from a browser checkout event. Active, trialing, and past-due subscriptions choose the plan; canceled subscriptions keep a one-week grace window from the last known billing period end. If a paid plan transaction arrives before the subscription webhook, Meridian grants 24 hours of provisional access so a successful payer does not get blocked while Paddle notifications catch up. Plan limits and durable prepaid credits are enforced for workflow-run ingestion, persisted REST metric samples, notification jobs, and report-share creation. Credit packs do not expire by time; usage charges are recorded idempotently in `BillingCreditLedgerEntry`. Denied writes return `402` with a safe reason, plan, limit, usage, and remaining-credit summary, and they also create secret-safe Billing log evidence for support review.

Paddle setup checklist:

1. Create the Paddle sandbox products/prices for Solo Beta, Agency Beta, Enterprise Pilot, and the three credit packs.
2. Add `NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, and all `NEXT_PUBLIC_PADDLE_PRICE_*` values to Vercel Production.
3. Add server-only `PADDLE_ENVIRONMENT=sandbox`, `PADDLE_SANDBOX_API_KEY`, and `PADDLE_NOTIFICATION_WEBHOOK_SECRET` to Vercel Production.
4. In Paddle, subscribe the notification destination `https://meridian.hrudainirmal.in/api/paddle/webhook` to customer, subscription, and transaction lifecycle events.
5. Redeploy, open Billing, complete a sandbox checkout, then confirm the subscription panel, Billing sync health, and Billing history update after the signed webhook arrives.

Account is also a dedicated sidebar section. It owns signed-in identity, organization/project context, Team and Settings shortcuts, and the only visible Sign out action.

Meridian supports GitHub OAuth, Google OAuth, and email/password sign-in. Email/password credentials are stored in `UserPasswordCredential` using salted `scrypt` hashes; raw passwords are never stored or logged. Configure Google login with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## Production Observability

Owners/admins can open `Testing` -> `Production observability` and refresh a secret-safe operations overview for the current project. The overview classifies existing signals as `Ready`, `Warning`, or `Blocked` across core dependencies, runtime safety, poll freshness, durable notification jobs, and ingestion usage guardrails. It is backed by `GET /api/projects/[projectId]/operations/overview`, which returns safe cards, evidence labels, and runbook paths only; it must never expose database URLs, OAuth secrets, encryption keys, cron secrets, email keys, Slack/webhook URLs, signing secrets, raw ingestion tokens, or encrypted payloads.

## Security And Access Hardening

Enterprise pilot builds apply baseline browser security headers through `next.config.ts`: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, and HSTS. The permissions policy keeps sensitive browser capabilities denied by default, including payment, camera, microphone, geolocation, accelerometer, gyroscope, USB, and browser topics. Public report routes remain token-scoped, revoked/expired reports return 404, and report pages/assets are configured as no-store. Production smoke verifies the main app shell and `/api/health` include the expected browser hardening headers. Owner/admin-only routes cover telemetry-token management, webhook/Slack destinations, report shares/presets, CSV exports, manual polling, notification-job retry/cancel, and production observability.

Manual production setup:

1. Create a production environment and `Meridian` app in Inngest.
2. Create an event key and copy the production signing key.
3. Add `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` to Vercel Production only.
4. Redeploy Meridian, then manually sync `https://meridian.hrudainirmal.in/api/inngest` from Inngest.
5. Keep `MERIDIAN_BACKGROUND_RECOVERY_MODE=off` and `MERIDIAN_RETENTION_CLEANUP_MODE=manual` unless an active pilot needs scheduled recovery or cleanup.
6. Open `Testing` -> `Idle posture` and `Notification jobs` to confirm zero-idle mode, Inngest readiness, and queue counts.

Do not configure Preview until it has a separate database and Inngest environment. For local development, run the app, start the Inngest Dev Server against `http://localhost:3000/api/inngest`, and use `INNGEST_DEV=1`; cloud keys are not required.

Testing notification actions return `202` and a job id. Testing follows the job to `SENT`, `FAILED`, `SKIPPED`, or `CANCELLED`. Logs supports job-status filters for every queue state. Owners/admins may retry failed jobs or cancel queued/retrying jobs.

Slack setup flow:

1. In Slack, create an incoming webhook for the target channel.
2. In Meridian, open `Integrations` -> `Slack alerts`.
3. Enter a destination name and paste the Slack incoming webhook URL.
4. Choose the minimum severity and event filters, then click `Add Slack destination`.
5. Use `Send test` in `Integrations` or `Testing` and confirm Slack receives the message.
6. Trigger and resolve a demo alert, then confirm alert details and Logs show Slack delivery status without exposing the URL.

SDK previews live in `sdk/python` and `sdk/js`. See `docs/sdk.md` for one-minute `@meridian.trace` examples, direct run ingestion, runnable disposable-token test scripts, timeout/error-hook setup, and the JavaScript `flush()` helper for short-lived scripts and serverless handlers. The JavaScript SDK is published as `@meridian-workflows/sdk`; Python remains package-ready for wheel dry runs but is not published to PyPI yet. Integrations now treats JavaScript SDK as a first-class telemetry template with install/env/snippet guidance and an `SDK run received` evidence state.

## Release And CI

Meridian uses GitHub Actions as the first enterprise-readiness gate. CI runs on pull requests and pushes to `main` with dependency install, Prisma client generation, typecheck, lint, production build, `npm run sdk:verify` for JavaScript/Python SDK package checks, and `npm run demo:verify` for the live workflow demo. A separate `Production smoke` workflow is manual so it can be dispatched after Vercel finishes deploying `main`.

`/api/health` includes safe build metadata: app version, commit SHA, optional build time, and environment. It also separates database reachability from database schema compatibility so an unapplied Prisma migration shows up before feature QA reaches a broken route. Testing -> Deployment readiness renders the same metadata for operators. These fields must never include database URLs, OAuth secrets, encryption keys, cron secrets, email provider keys, Slack webhook URLs, webhook signing secrets, raw ingestion tokens, or encrypted payloads.

Meridian currently uses a minimum-safe environment model: Production is the only live runtime, and even Production defaults to zero idle scheduled work. Preview deployments and local development may render the app and readiness state, but external side effects are disabled by default outside Production. That means cron polling, manual endpoint polling, Resend email sends, Slack incoming-webhook sends, generic webhook sends, and Inngest cloud worker execution are blocked or skipped unless an explicit operator opt-in is configured. `/api/health` and Testing -> Deployment readiness show the runtime label, deployment URL, side-effect policy, background-job policy, cron policy, and safe warnings. Testing -> Idle posture shows whether scheduled recovery, retention cleanup, external polling, and live refresh are manual or explicitly enabled. The optional escape hatches `MERIDIAN_ALLOW_EXTERNAL_EFFECTS=1` and `MERIDIAN_ALLOW_BACKGROUND_JOBS=1` are reserved for deliberate isolated Preview/dev testing, not for shared production data.

### Self-Hosted Runtime Foundation

Self-Hosted Runtime Foundation v1 adds explicit deployment-mode switches while keeping hosted Meridian as the default Cloud posture:

```env
MERIDIAN_DEPLOYMENT_MODE=cloud | self_hosted
MERIDIAN_EDITION=cloud | community | enterprise
MERIDIAN_BILLING_MODE=paddle | disabled | license
MERIDIAN_JOB_BACKEND=inngest | self_hosted | manual
```

`MERIDIAN_JOB_BACKEND` is the preferred job-backend switch; existing `MERIDIAN_DEFAULT_JOB_BACKEND` deployments continue to work as a fallback. When `MERIDIAN_DEPLOYMENT_MODE=self_hosted`, missing billing and job-backend env values default to `disabled` billing and `self_hosted` jobs. Testing -> Deployment readiness shows the runtime mode, edition, billing mode, job backend, and side-effect posture. Billing disables hosted checkout in self-hosted/community mode and shows `Community self-hosted` instead of asking for Paddle setup. The self-hosted notification bridge expects `MERIDIAN_SELF_HOSTED_WORKER_URL` and `MERIDIAN_SELF_HOSTED_WORKER_SECRET`; Docker Compose packaging for the local worker is the next self-hosting slice.

Full Preview isolation with a separate Neon database and separate Inngest environment is deferred until Preview is used for mutation QA. Until then, do not point Preview at production data for active testing.

Release notes start in `CHANGELOG.md`. Keep `package.json` semver and the changelog aligned for production-facing changes.

Production release order:

```bash
# Requires DATABASE_URL/NeonDB_POSTGRES_PRISMA_URL for the intended production database.
npm run prisma:deploy
npm run release:check
SMOKE_BASE_URL="https://meridian.hrudainirmal.in" SMOKE_REQUIRE_READY=1 npm run test:smoke
```

`npm run release:prod` runs those three commands in sequence for the canonical production domain. Use it only when the shell environment is pointed at the intended production database. `release:check` is non-mutating: it fails when Prisma reports pending migrations and redacts connection strings, Neon password-like values, bearer tokens, and Slack webhook URLs from command output.

## Deployed QA

Run public smoke checks against a deployment:

```bash
SMOKE_BASE_URL="https://meridian.hrudainirmal.in" npm run test:smoke
```

Authenticated smoke checks can use a Playwright storage state file:

```bash
SMOKE_BASE_URL="https://meridian.hrudainirmal.in" SMOKE_AUTH_STATE="./playwright-auth.json" npm run test:smoke
```

Optional mutation checks create private-beta test data:

```bash
SMOKE_BASE_URL="https://meridian.hrudainirmal.in" SMOKE_AUTH_STATE="./playwright-auth.json" SMOKE_MUTATION=1 npm run test:smoke
```

Manual production smoke workflow:

1. Wait for Vercel to finish deploying `main`.
2. Run `npm run prisma:deploy` against the production database.
3. Run `npm run release:check` and confirm Prisma reports no pending migrations.
4. In GitHub Actions, run `Production smoke`.
5. Confirm the workflow passes without creating production data.

Use `docs/private-beta-qa.md` for the full side-by-side private-beta manual QA flow. It covers sign-in, projects, Automation Map, runs, telemetry, polling, alerts, reports, integrations, Testing, Logs, Settings, and secret-safety checks.

Manual post-deploy checklist:

- Fresh browser session reaches the Meridian sign-in screen and shows configured sign-in options.
- New user onboarding creates either a blank or demo project.
- Existing users land in the dashboard without repeated onboarding.
- Project switch, create, rename, and archive behave predictably.
- Graph node edits autosave and survive refresh.
- Automation Map handles are visible on every node; the React Flow attribution watermark is hidden; view mode cannot create links, Edit mode can drag output-to-input links, clicked links expose a label editor, link labels autosave, self-links and duplicate same-direction links are blocked, and saved links survive refresh.
- Team invitation save shows a visible result.
- Team shows `Project Access Review` and `Role Capability Matrix` so owners/admins can explain owner/admin/member/viewer capabilities before inviting enterprise stakeholders.
- Duplicate pending invitations for the same email return the existing pending invite instead of creating another row.
- Pending invited users are attached to the organization on first matching GitHub login.
- Accepted invitations, duplicate invite attempts, role changes, removals, and cancelled pending invitations write safe audit evidence.
- Owner/admin users can change roles, remove members, and cancel pending invitations; at least one owner must remain.
- Webhook and Slack destination management is owner/admin-only, while members can still manage map/node setup and alert rules.
- API setup stores configuration without exposing secret values; auth header and secret fields appear only after an auth type is selected and are required for authenticated endpoint tests/saves.
- API setup test shows response status, JSON preview, JSONPath mapping, threshold preview, and right-panel guidance for the currently selected setup field.
- REST metric onboarding keeps saved API setup separate from real sample evidence: after saving mappings, use the selected node's `REST metric first signal` card to run the first poll, then confirm `Real sample received` shows the latest persisted value and timestamp.
- Custom PNG/SVG node icon upload validates file type and size.
- `/api/cron/poll` rejects a wrong bearer token.
- Testing shows database, auth, encryption, cron, email provider readiness, latest poll status, and latest email delivery status.
- Testing shows safe app version, commit, build time, and environment metadata.
- Testing -> Project usage shows bounded usage counts, active token count, ingestion rate limits, and retention policy summaries without exposing tokens, webhook URLs, signing secrets, encrypted payloads, or env values.
- Owner/admin test email from Testing returns clear success or failure feedback and does not expose `RESEND_API_KEY`.
- Owner/admin manual poll run from Testing updates latest poll diagnostics without exposing `CRON_SECRET`.
- Owner/admin workflow telemetry token creation shows the raw token once, token refresh lists only prefixes, revoke blocks future ingestion, and `/api/ingest/runs` rejects missing/wrong tokens.
- In Integrations, Dify, n8n, GitHub Actions, and JavaScript SDK templates show provider-specific setup steps plus a provider first-signal card that moves from token creation to test/external run to real run evidence.
- Posting valid workflow run telemetry updates the selected node's Runs tab after refresh and records step details without sending alert email.
- While signed in, the dashboard live indicator reaches `Live`; posting valid workflow run telemetry or running a manual poll updates Runs, node health, alerts, metrics, and latest poll status without a full page reload.
- If live updates disconnect, the dashboard header and Control Room show a reconnecting/manual state, the latest changed areas remain visible, and manual refresh still works.
- Interactive Tutorial v2 auto-starts for no-telemetry projects, keeps the page undimmed/clickable, highlights real components, supports drag/snap plus hide/show, shows evidence progress, and guides REST metric setup through Map, Integrations, the selected-node first-poll card, metric evidence, and Reports without exposing secrets.
- Basic and Advanced integration templates render in the API tab; custom REST metric applies fields without saving, and telemetry snippets include the selected node id but no real token.
- Client report links can be created, opened in a signed-out browser, copied, and revoked without exposing secrets.
- Client reports can include subtitle/prepared-by/executive note fields, optional PNG/SVG brand images, attached map PNGs, and browser print/save-as-PDF output.
- Project maps can be exported as PNGs for stakeholder reports.
- The demo metric shortcut can configure a node with `$.value > 90` for controlled alert QA.
- After saving the demo metric and running poll now, the selected node shows a real `95 score` metric card, persisted sample trend, freshness label, and alert context after refresh.
- Notification preferences save enabled/disabled email alerts and minimum severity per signed-in user.
- Webhook destinations can be created, tested, enabled/disabled, deleted, and copied with a one-time signing secret; disabled destinations do not receive alert events.
- Slack destinations can be created, tested, enabled/disabled, and deleted from Integrations; list responses never expose the incoming webhook URL.
- Remediation actions can be created with a one-time signing secret, tested as dry-run actions, manually run from alert details, optionally set to automatic-on-alert mode, and reviewed in Logs without exposing action URLs or signing secrets.
- Logs loads a combined bounded timeline, filters by type/window/text, returns safe limit/truncation metadata, and never exposes raw secrets, raw tokens, encrypted payloads, webhook signing secrets, Slack incoming webhook URLs, env values, or private credential bodies.
- Contextual sidebar mode shows the selected section heading/back button plus subsection anchors, and Back returns to the main section list without changing the active page content.
- Alert rules can be created from saved parameter mappings; repeated breaches update the same incident's last-seen time and occurrence count, and rule-level suppression controls when a grouped active incident can notify again.
- New alert incidents send `alert.opened` webhooks and Slack messages, resolved/ignored incidents send `alert.resolved` webhooks and Slack messages, and alert details show latest webhook and Slack delivery status.
- Anomaly alert rules can be created from saved parameter mappings; the setup preview should show sample history, mean/std dev, watch bands, wait for enough history, explain baseline context in alert messages, and avoid duplicate unresolved emails.
- Light mode remains readable with stronger text, borders, graph canvas dots, dialogs, report cards, and empty states; dark mode remains neutral black/grey.
- `/api/health` reports database schema compatibility and does not include raw env var values, database URLs, OAuth secrets, or encrypted credential payloads.

## Local Development

Local development is secondary to the deployed Vercel app.

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run dev
```

## Private Beta Scope

On first OAuth or email/password login, Meridian creates a personal organization and owner membership, then shows onboarding to confirm organization/project names and choose demo or blank setup.

The app now includes project management, team invitation acceptance, member management, encrypted API credential storage, guided metric mapping tests, visible edit-mode map connection handles with editable link labels, focused basic/advanced integration templates, compact threshold/anomaly alert-rule management with baseline previews, signed outbound alert webhooks, native Slack incoming-webhook alerts, signed safe remediation actions, cron/manual polling, SSE-first live update signals with Control Room status and manual fallback, workflow run telemetry ingestion with hashed project tokens and durable rate limits, secure client report links, bounded CSV exports, PNG map export, SDK previews, a deterministic demo metric source, real metric cards and trend charts from persisted samples/rollups, first-class Testing and Logs sections, contextual sidebar subsections, audit-backed safe operational logs, retention cleanup, in-app alerts, Resend email delivery logging/test flow/preferences, and small custom node icon uploads.
