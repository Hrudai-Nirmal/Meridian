# ArgusGrid

ArgusGrid is the AI automation control room for agencies and teams. Projects open to a graph-first automation map; selecting a node shows health, API metadata, alerts, recent runs, cost, latency, token usage, and quality signals so teams can prove whether automations are reliable and worth running.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui
- Auth.js with GitHub OAuth and Prisma adapter
- Prisma + Neon Postgres
- React Flow for project maps
- Apache ECharts for dashboard visualizations

## Environment

Set these values in Vercel for the deployed app:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/argusgrid?sslmode=require"
NEXTAUTH_URL="https://your-vercel-domain.vercel.app"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
ENCRYPTION_KEY="replace-with-a-long-random-encryption-key"
GITHUB_ID="replace-with-github-oauth-client-id"
GITHUB_SECRET="replace-with-github-oauth-client-secret"
CRON_SECRET="replace-with-a-long-random-cron-secret"
RESEND_API_KEY="optional-resend-api-key-for-alert-email"
ALERT_FROM_EMAIL="ArgusGrid <alerts@example.com>"
```

On Vercel, ArgusGrid prefers the Neon integration-managed `NeonDB_POSTGRES_PRISMA_URL` when present and falls back to `DATABASE_URL` for local or independently managed Postgres deployments. Database and authentication failures emit structured, secret-safe runtime logs with incident IDs; `/api/health` returns matching safe issue metadata, and the login screen blocks OAuth while session persistence is unavailable.

Production diagnosis and recovery steps live in `docs/incident-response.md`.

GitHub OAuth callback URL:

```text
https://your-vercel-domain.vercel.app/api/auth/callback/github
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

Vercel cron is configured in `vercel.json` to call `/api/cron/poll` daily as a backup for Hobby-compatible limits. The primary high-frequency scheduler can be one ArgusGrid-owned cron-job.org job that calls the same route every minute. The route requires `CRON_SECRET` and accepts either:

- `Authorization: Bearer <CRON_SECRET>`
- HTTP Basic auth with username `argusgrid-cron` and password `<CRON_SECRET>`

cron-job.org setup:

```text
Title: ArgusGrid production poll
URL: https://argusgrid.hrudainirmal.in/api/cron/poll
Schedule: every minute
Method: GET
HTTP auth username: argusgrid-cron
HTTP auth password: production CRON_SECRET
```

After creating the job, run a manual test execution in cron-job.org and expect HTTP 200 with `ok: true` and `mode: "secured-cron"`. Then confirm Testing and `/api/health` show updated latest poll metadata.

The deployed app exposes `/api/health` for safe readiness checks. It returns booleans and poll metadata only; it must never return secret values.

Owners/admins can send a harmless test alert email from Testing after `RESEND_API_KEY` and `ALERT_FROM_EMAIL` are configured. Delivery attempts are logged per recipient with status, provider, timestamps, and safe failure summaries.

Owners/admins can also run a project poll manually from Testing for demos. The public `/api/demo/metric` route returns a deterministic sample for private-beta alert QA.

The dashboard information architecture keeps Settings configuration-only: notification preferences, telemetry tokens, and project environment context. Integrations owns setup for telemetry providers, generic alert webhooks, and native Slack destinations. Testing owns deployment readiness, manual poll, test email, webhook/Slack tests, integration readiness, endpoint setup shortcuts, and demo metric QA. Logs provides a unified safe project timeline with 24h/7d/30d/All windows, type filters, search, and entries from audit activity, alerts, polling, deliveries, runs, reports, webhooks, Slack, team actions, and map changes.

When a main dashboard section is selected, the sidebar switches to contextual mode: the active section heading acts as a back button and one-level subsection anchors appear below it. Back returns to the main section list without changing the active page.

Owners/admins can create secure client-facing report links from the dashboard. Report links render a read-only project summary with uptime, run volume, success rate, cost, token usage, active alerts, quality score, node summaries, map imagery, and recent incidents. Links can expire and can be revoked.

The Reports section includes an in-app report preview, minimal client/agency customization fields, manual map PNG attachment, browser print/save-as-PDF support, and owner/admin CSV exports for runs, metric samples, and alerts. CSV exports default to a bounded 30-day window with a 5,000-row default cap and 10,000-row hard cap; response headers report row count, row limit, and truncation. Exports and public reports never include API credentials, ingestion tokens, encrypted secrets, or private team/member details.

Automation Map nodes include visible input and output connection handles. In view mode the handles are visible but locked; in `Edit mode`, drag from a node's right output handle to another node's left input handle to create an autosaved visual workflow link. Click a link to open its label editor, then rename the workflow handoff while Edit mode is on. Self-links and duplicate source-to-target links are blocked.

Client report flow:

1. Open `Reports`.
2. Fill report title, client name, subtitle/period, prepared-by, executive note, and expiry window.
3. Click `Attach current map` to store the current Automation Map PNG with the next report link.
4. Confirm the in-app preview shows summary metrics and the attached map.
5. Click `Create link`, then open the public report link in a signed-out browser.
6. Use `Print / Save PDF` on the public report page for a browser-generated PDF.

Attached maps are served through `/reports/[shareToken]/map.png`; expired or revoked report links return `404` for both the report page and map image.

Authenticated dashboards connect to `/api/projects/[projectId]/events` for lightweight live updates. The SSE stream only sends safe project-scoped metadata such as cursors and changed areas, then the client refreshes the existing project payload. If the stream disconnects, the dashboard shows a reconnecting/manual state and the existing refresh controls remain available.

The dashboard header and Control Room show the live stream state, last checked time, latest changed areas, and a manual `Refresh telemetry now` fallback. Use this to verify whether new runs, polling changes, and alert updates are arriving through the live signal path or need manual refresh.

Owners/admins can create project-scoped workflow telemetry tokens from Deployment diagnostics. The raw token is shown once, then only its prefix/hash metadata is retained. External automations can post run telemetry with:

```bash
curl -X POST "https://your-vercel-domain.vercel.app/api/ingest/runs" \
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

The node inspector includes Basic and Advanced integration templates for Dify, n8n, GitHub Actions, and OpenAI/custom REST metrics. Basic templates explain the setup path and Advanced templates provide copyable snippets that use the selected node id and `<ingestion-token>` placeholders. The Integrations section also provides a guided setup hub: select a node and provider, create a one-time provider-named ingestion token, send a harmless synthetic test run for telemetry integrations, and refresh readiness from existing runs, samples, mappings, and alert rules.

Alert rules support static thresholds and anomaly baselines. Anomaly rules learn from the previous 7 days of metric samples, require at least 8 prior samples, and fire when the next value is more than 2 standard deviations outside the selected direction. The node inspector's alert-rule dialog previews the selected mapping's sample count, baseline mean, standard deviation, watch band, and whether more samples are needed before anomaly alerts can fire.

Project editors can create outbound webhook destinations from `Integrations` and test them from `Integrations` or `Testing`. ArgusGrid sends `alert.opened`, `alert.resolved`, and `webhook.test` JSON payloads to enabled destinations, retries once on failure, and records webhook delivery status in alert details and Logs. Signing secrets are shown once at creation and are not exposed again.

Webhook receivers can verify these headers:

```text
X-ArgusGrid-Event: alert.opened | alert.resolved | webhook.test
X-ArgusGrid-Delivery: delivery UUID
X-ArgusGrid-Timestamp: ISO timestamp
X-ArgusGrid-Signature: sha256=<hmac>
```

The signature is HMAC SHA-256 over `timestamp.rawJsonBody` using the destination signing secret.

Native Slack alert destinations also live in `Integrations`, using Slack incoming webhook URLs. Create a Slack destination with a friendly name, a `https://hooks.slack.com/...` incoming webhook URL, minimum severity, and event filters for `alert.opened`, `alert.resolved`, and `slack.test`. The webhook URL is encrypted, write-only, and never returned to the browser after creation. ArgusGrid sends Slack Block Kit messages for matching enabled destinations, retries once on failure, and records delivery evidence in alert details and Logs.

Slack setup flow:

1. In Slack, create an incoming webhook for the target channel.
2. In ArgusGrid, open `Integrations` -> `Slack alerts`.
3. Enter a destination name and paste the Slack incoming webhook URL.
4. Choose the minimum severity and event filters, then click `Add Slack destination`.
5. Use `Send test` in `Integrations` or `Testing` and confirm Slack receives the message.
6. Trigger and resolve a demo alert, then confirm alert details and Logs show Slack delivery status without exposing the URL.

SDK previews live in `sdk/python` and `sdk/js`. See `docs/sdk.md` for one-minute `@argusgrid.trace` examples.

## Release And CI

ArgusGrid uses GitHub Actions as the first enterprise-readiness gate. CI runs on pull requests and pushes to `main` with dependency install, Prisma client generation, typecheck, lint, and production build. A separate `Production smoke` workflow is manual so it can be dispatched after Vercel finishes deploying `main`.

`/api/health` includes safe build metadata: app version, commit SHA, optional build time, and environment. Testing -> Deployment readiness renders the same metadata for operators. These fields must never include database URLs, OAuth secrets, encryption keys, cron secrets, email provider keys, Slack webhook URLs, webhook signing secrets, raw ingestion tokens, or encrypted payloads.

Release notes start in `CHANGELOG.md`. Keep `package.json` semver and the changelog aligned for production-facing changes.

## Deployed QA

Run public smoke checks against a deployment:

```bash
SMOKE_BASE_URL="https://your-vercel-domain.vercel.app" npm run test:smoke
```

Authenticated smoke checks can use a Playwright storage state file:

```bash
SMOKE_BASE_URL="https://your-vercel-domain.vercel.app" SMOKE_AUTH_STATE="./playwright-auth.json" npm run test:smoke
```

Optional mutation checks create private-beta test data:

```bash
SMOKE_BASE_URL="https://your-vercel-domain.vercel.app" SMOKE_AUTH_STATE="./playwright-auth.json" SMOKE_MUTATION=1 npm run test:smoke
```

Manual production smoke workflow:

1. Wait for Vercel to finish deploying `main`.
2. In GitHub Actions, run `Production smoke`.
3. Confirm the workflow passes without creating production data.

Use `docs/private-beta-qa.md` for the full side-by-side private-beta manual QA flow. It covers sign-in, projects, Automation Map, runs, telemetry, polling, alerts, reports, integrations, Testing, Logs, Settings, and secret-safety checks.

Manual post-deploy checklist:

- Fresh browser session reaches GitHub sign-in.
- New user onboarding creates either a blank or demo project.
- Existing users land in the dashboard without repeated onboarding.
- Project switch, create, rename, and archive behave predictably.
- Graph node edits autosave and survive refresh.
- Automation Map handles are visible on every node; the React Flow attribution watermark is hidden; view mode cannot create links, Edit mode can drag output-to-input links, clicked links expose a label editor, link labels autosave, self-links and duplicate same-direction links are blocked, and saved links survive refresh.
- Team invitation save shows a visible result.
- Pending invited users are attached to the organization on first matching GitHub login.
- Owner/admin users can change roles, remove members, and cancel pending invitations.
- API setup stores configuration without exposing secret values.
- API setup test shows response status, JSON preview, JSONPath mapping, and threshold preview.
- Custom PNG/SVG node icon upload validates file type and size.
- `/api/cron/poll` rejects a wrong bearer token.
- Testing shows database, auth, encryption, cron, email provider readiness, latest poll status, and latest email delivery status.
- Testing shows safe app version, commit, build time, and environment metadata.
- Owner/admin test email from Testing returns clear success or failure feedback and does not expose `RESEND_API_KEY`.
- Owner/admin manual poll run from Testing updates latest poll diagnostics without exposing `CRON_SECRET`.
- Owner/admin workflow telemetry token creation shows the raw token once, token refresh lists only prefixes, revoke blocks future ingestion, and `/api/ingest/runs` rejects missing/wrong tokens.
- Posting valid workflow run telemetry updates the selected node's Runs tab after refresh and records step details without sending alert email.
- While signed in, the dashboard live indicator reaches `Live`; posting valid workflow run telemetry or running a manual poll updates Runs, node health, alerts, metrics, and latest poll status without a full page reload.
- If live updates disconnect, the dashboard header and Control Room show a reconnecting/manual state, the latest changed areas remain visible, and manual refresh still works.
- Basic and Advanced integration templates render in the API tab; custom REST metric applies fields without saving, and telemetry snippets include the selected node id but no real token.
- Client report links can be created, opened in a signed-out browser, copied, and revoked without exposing secrets.
- Client reports can include subtitle/prepared-by/executive note fields, attached map PNGs, and browser print/save-as-PDF output.
- Project maps can be exported as PNGs for stakeholder reports.
- The demo metric shortcut can configure a node with `$.value > 90` for controlled alert QA.
- After saving the demo metric and running poll now, the selected node shows a real `95 score` metric card, persisted sample trend, freshness label, and alert context after refresh.
- Notification preferences save enabled/disabled email alerts and minimum severity per signed-in user.
- Webhook destinations can be created, tested, enabled/disabled, deleted, and copied with a one-time signing secret; disabled destinations do not receive alert events.
- Slack destinations can be created, tested, enabled/disabled, and deleted from Integrations; list responses never expose the incoming webhook URL.
- Logs loads a combined bounded timeline, filters by type/window/text, returns safe limit/truncation metadata, and never exposes raw secrets, raw tokens, encrypted payloads, webhook signing secrets, Slack incoming webhook URLs, env values, or private credential bodies.
- Contextual sidebar mode shows the selected section heading/back button plus subsection anchors, and Back returns to the main section list without changing the active page content.
- Alert rules can be created from saved parameter mappings and new alert emails are not repeated while the alert remains unresolved.
- New alert incidents send `alert.opened` webhooks and Slack messages, resolved/ignored incidents send `alert.resolved` webhooks and Slack messages, and alert details show latest webhook and Slack delivery status.
- Anomaly alert rules can be created from saved parameter mappings; the setup preview should show sample history, mean/std dev, watch bands, wait for enough history, explain baseline context in alert messages, and avoid duplicate unresolved emails.
- Light mode remains readable with stronger text, borders, graph canvas dots, dialogs, report cards, and empty states; dark mode remains neutral black/grey.
- `/api/health` does not include raw env var values, database URLs, OAuth secrets, or encrypted credential payloads.

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

On first GitHub login, ArgusGrid creates a personal organization and owner membership, then shows onboarding to confirm organization/project names and choose demo or blank setup.

The app now includes project management, team invitation acceptance, member management, encrypted API credential storage, guided metric mapping tests, visible edit-mode map connection handles with editable link labels, focused basic/advanced integration templates, compact threshold/anomaly alert-rule management with baseline previews, signed outbound alert webhooks, native Slack incoming-webhook alerts, cron/manual polling, SSE-first live update signals with Control Room status and manual fallback, workflow run telemetry ingestion with hashed project tokens, secure client report links, bounded CSV exports, PNG map export, SDK previews, a deterministic demo metric source, real metric cards and trend charts from persisted samples/rollups, first-class Testing and Logs sections, contextual sidebar subsections, audit-backed safe operational logs, raw sample retention cleanup, in-app alerts, Resend email delivery logging/test flow/preferences, and small custom node icon uploads.
