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

After creating the job, run a manual test execution in cron-job.org and expect HTTP 200 with `ok: true` and `mode: "secured-cron"`. Then confirm Settings shows an updated latest poll.

The deployed app exposes `/api/health` for safe readiness checks. It returns booleans and poll metadata only; it must never return secret values.

Owners/admins can send a harmless test alert email from Deployment diagnostics after `RESEND_API_KEY` and `ALERT_FROM_EMAIL` are configured. Delivery attempts are logged per recipient with status, provider, timestamps, and safe failure summaries.

Owners/admins can also run a project poll manually from Deployment diagnostics for demos. The public `/api/demo/metric` route returns a deterministic sample for private-beta alert QA.

Owners/admins can create secure client-facing report links from the dashboard. Report links render a read-only project summary with uptime, run volume, success rate, cost, token usage, active alerts, quality score, node summaries, map imagery, and recent incidents. Links can expire and can be revoked.

The Reports section includes an in-app report preview, minimal client/agency customization fields, manual map PNG attachment, browser print/save-as-PDF support, and owner/admin CSV exports for runs, metric samples, and alerts. Exports and public reports never include API credentials, ingestion tokens, encrypted secrets, or private team/member details.

Automation Map nodes include visible input and output connection handles. In view mode the handles are visible but locked; in `Edit mode`, drag from a node's right output handle to another node's left input handle to create an autosaved visual workflow link. Self-links and duplicate source-to-target links are blocked.

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

SDK previews live in `sdk/python` and `sdk/js`. See `docs/sdk.md` for one-minute `@argusgrid.trace` examples.

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

Manual post-deploy checklist:

- Fresh browser session reaches GitHub sign-in.
- New user onboarding creates either a blank or demo project.
- Existing users land in the dashboard without repeated onboarding.
- Project switch, create, rename, and archive behave predictably.
- Graph node edits autosave and survive refresh.
- Automation Map handles are visible on every node; view mode cannot create links, Edit mode can drag output-to-input links, self-links and duplicate same-direction links are blocked, and saved links survive refresh.
- Team invitation save shows a visible result.
- Pending invited users are attached to the organization on first matching GitHub login.
- Owner/admin users can change roles, remove members, and cancel pending invitations.
- API setup stores configuration without exposing secret values.
- API setup test shows response status, JSON preview, JSONPath mapping, and threshold preview.
- Custom PNG/SVG node icon upload validates file type and size.
- `/api/cron/poll` rejects a wrong bearer token.
- Deployment diagnostics show database, auth, encryption, cron, email provider readiness, latest poll status, and latest email delivery status.
- Owner/admin test email returns clear success or failure feedback and does not expose `RESEND_API_KEY`.
- Owner/admin manual poll run updates latest poll diagnostics without exposing `CRON_SECRET`.
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
- Alert rules can be created from saved parameter mappings and new alert emails are not repeated while the alert remains unresolved.
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

The app now includes project management, team invitation acceptance, member management, encrypted API credential storage, guided metric mapping tests, visible edit-mode map connection handles, focused basic/advanced integration templates, compact threshold/anomaly alert-rule management with baseline previews, cron/manual polling, SSE-first live update signals with Control Room status and manual fallback, workflow run telemetry ingestion with hashed project tokens, secure client report links, PNG map export, SDK previews, a deterministic demo metric source, real metric cards and trend charts from persisted samples/rollups, poll execution logs, readiness diagnostics, raw sample retention cleanup, in-app alerts, Resend email delivery logging/test flow/preferences, and small custom node icon uploads.
