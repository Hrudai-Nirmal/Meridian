# Meridian Interview Study Guide

This document is a comprehensive technical and product context packet for Meridian. It is intended to be given to ChatGPT or another interviewer-style assistant so it can deeply quiz the project owner on product strategy, architecture, implementation details, tradeoffs, security, reliability, billing, self-hosting, and remaining roadmap.

No secrets, raw tokens, database URLs, OAuth secrets, Paddle keys, Slack/webhook URLs, encrypted payloads, or private credentials are included here.

## How To Use This With ChatGPT

Paste or upload this file into ChatGPT and use a prompt like:

```text
You are a senior product-engineering interviewer. Use the attached Meridian study guide as source context. Grill me on the project as if I built it and need to defend product decisions, architecture, data model, reliability, security, billing, and tradeoffs. Ask one question at a time. After each answer, grade me, correct gaps, and ask deeper follow-ups. Focus on whether I understand the implementation, not whether I memorized marketing copy.
```

Good interview modes to ask for:

- Product manager interview: positioning, customer pain, ICP, onboarding, pricing, self-hosting strategy.
- Full-stack engineering interview: Next.js App Router, React dashboard, route handlers, Prisma, Auth.js, Postgres, React Flow, charts.
- Systems design interview: ingestion, polling, alerting, durable jobs, notification delivery, zero-idle architecture, scaling.
- Security interview: RBAC, secret storage, token hashing, HMAC, public reports, billing webhooks, logs, exports.
- Reliability interview: health checks, smoke tests, release gates, recovery, retries, idempotency, incident response.
- Business interview: pricing, credit system, Paddle billing, free/paid limits, open-source/self-hosting levels.

## One-Line Description

Meridian is an AI automation control room for agencies and teams: it maps automations visually, ingests workflow and metric telemetry, detects incidents, notifies teams, and creates client-facing proof reports that show reliability, cost, token usage, and ROI.

## Product Overview

Meridian exists because AI automation agencies and internal AI ops teams need more than a workflow builder. They need operational proof that automations are working, staying reliable, staying affordable, and delivering client-visible value.

The core product concept is graph-first. A project opens to an Automation Map. Nodes represent automations, APIs, agents, tools, Dify apps, n8n flows, GitHub Actions, SDK-instrumented scripts, or REST metric endpoints. Each node has health, runs, metrics, alerts, setup, and reporting context.

Meridian’s product promise:

- Monitor AI automations and operational workflows in one place.
- Detect failures, degraded performance, cost spikes, token spikes, stale data, and metric anomalies.
- Send reliable notifications through email, Slack, and signed generic webhooks.
- Keep logs and exports secret-safe.
- Give agencies client proof through branded shareable reports, printable pages, CSV exports, comparison metrics, and incident timelines.
- Keep idle infrastructure cost low by default.
- Grow into both hosted SaaS and self-hosted/community deployments.

## Target Users

Primary customer:

- AI automation agencies serving clients.
- They build automations in tools like Dify, n8n, GitHub Actions, custom scripts, or REST APIs.
- They need client-friendly proof that the automations are reliable and worth paying for.

Secondary customer:

- Internal AI ops teams.
- They need monitoring and reporting for AI agents, workflow automation, cost, tokens, quality, and operational incidents.

Why agencies are the sharper initial wedge:

- They have direct client reporting pressure.
- They can tolerate setup complexity if it gives them a strong deliverable.
- They value proof, branding, exports, and shareable reports.
- They can start with a small number of workflows but need professional reporting quickly.

## Product Positioning

Meridian is not primarily a workflow builder. It is an operational control room and client-proof layer on top of workflow builders.

Related categories:

- Observability for AI automations.
- Workflow telemetry and reliability monitoring.
- Client proof/reporting for automation agencies.
- AI ops dashboard.

Where Meridian sits:

- Dify/n8n/GitHub Actions/custom agents continue to execute workflows.
- Meridian receives telemetry, polls REST metrics, evaluates rules, queues notifications, and produces reports.
- It becomes the truth layer for operational evidence.

## Current Product State

Meridian is private-beta oriented but has a substantial production-grade foundation:

- Signed-out homepage at `/` for new visitors.
- Authenticated graph-first dashboard.
- GitHub, Google, and email/password auth.
- Team model with owner/admin/member/viewer roles.
- Project-based automation maps using React Flow.
- Telemetry ingestion for workflow runs.
- REST metric polling and JSONPath mapping.
- Alert rules for metric samples and workflow runs.
- Durable notification jobs.
- Slack, email, and generic webhook destinations.
- Safe remediation actions.
- Client proof reports with presets, periods, comparisons, brand/map assets, print/PDF flow, and CSV exports.
- Billing with Paddle, subscriptions, credit packs, usage limits, and entitlement enforcement.
- Logs, Testing, Integrations, Billing, Account, Team, Settings sections.
- CI, production smoke, health checks, schema readiness checks, and release gates.
- Zero-idle defaults.
- Self-hosting foundation and self-hosted notification bridge started.

## Major User-Facing Sections

### Signed-Out Homepage

Signed-out users see a polished Meridian landing page instead of the dashboard/login-only screen.

Key elements:

- Dark-theme public homepage.
- Hero positioning around AI automation control room.
- Cursor-reactive DotField background.
- Centered fixed rounded header.
- Big animated Meridian wordmark.
- Automation Map preview.
- Integration paths showing data ingestion from Dify, n8n, GitHub Actions, SDK/API telemetry, and REST metrics.
- Reliability-focused proof.
- Pricing preview.
- Sign-in/register panel with GitHub, Google, and email/password flows.

Authenticated users visiting `/` load the actual dashboard. New users with no workspace go through onboarding/bootstrap.

### Automation Map

The Automation Map is the core workspace. It is built with React Flow.

Nodes represent automations/endpoints. Edges are visual workflow relationships. The map is not currently an execution engine and edges do not change polling order or run routing.

Implemented features:

- Graph-first dashboard default.
- Node creation, editing, dragging, and snapping.
- Autosaved node position and graph state.
- Visible input/output handles on each node.
- Edit mode gates graph mutations.
- Drag output handle to another node’s input handle to create links.
- Self-links and duplicate source-target edges are blocked.
- Link labels can be edited.
- Map PNG export for reports.
- Node icon upload with validation.
- Node inspector tabs: Overview, Metrics, Runs, Alerts, Setup.
- React Flow attribution watermark hidden.

Important design decision:

- The graph is a representation of operational relationships, not orchestration. This keeps Meridian compatible with any workflow system.

### Control Room

Control Room summarizes project status:

- Node health.
- Run success.
- Active alerts.
- Poll/email readiness.
- Cost.
- Metric streams.
- Attention items.
- Pilot onboarding checklist.
- Tutorial controls.
- Live/manual refresh status.

It is the executive/operator overview, while Automation Map remains the primary operational canvas.

### Projects

Projects are organization-scoped workspaces.

Implemented:

- Create project.
- Rename project.
- Archive project.
- Project cards with summary counts and latest sample timestamps.
- Project switching.
- Per-project operations policy.
- Project-scoped teams, nodes, report shares, alert rules, integrations, billing usage, and logs.

Projects belong to organizations and respect membership roles.

### Runs

Runs represent workflow telemetry submitted by external automations.

Examples:

- Dify chatbot execution.
- n8n workflow.
- GitHub Actions job.
- JavaScript SDK traced function.
- Custom agent pipeline.

Run payload includes:

- Node id.
- External id.
- Status: success, degraded, failed.
- Started/finished timestamps.
- Cost.
- Tokens.
- Step details: name, status, latency, tool name.

Runs update:

- Node summary cards.
- Runs table.
- Logs.
- Alert rules for run-derived incidents.
- Client reports.
- Usage enforcement.

Important implementation detail:

- Meridian clearly distinguishes sample fallback rows from real persisted telemetry. Sample rows are only educational/demo UI and do not count toward tutorial progress or operational proof.

### Metrics

Metric samples come mainly from REST polling.

Flow:

1. User configures an endpoint URL.
2. User configures auth if needed.
3. User maps JSON values using JSONPath.
4. User tests the endpoint.
5. User saves mapping.
6. User manually polls or enables scheduled polling.
7. Meridian stores `MetricSample` rows.
8. Meridian computes rollups and node summaries.
9. Alert rules evaluate metric thresholds/anomalies.

Metric examples:

- Latency.
- Uptime score.
- Quality score.
- Queue depth.
- Cost.
- Token count.
- Custom API values.

API setup UX:

- Fields start empty unless saved.
- Auth header/secret fields appear only when auth type is selected.
- Auth fields are compulsory when auth is selected.
- Right side of modal shows contextual help for the selected field.
- Endpoint test previews response status, JSON/non-JSON body, mapped values, transforms, and threshold feedback.

### Alerts

Meridian supports incident detection from both metrics and workflow runs.

Metric-source alert rules:

- Static threshold: examples like `> 90`, `< 200`, etc.
- Baseline/anomaly detection: high spike, low dip, or both.
- Anomaly detection compares against previous samples, uses enough-history checks, and shows baseline preview.

Run-source alert rules:

- Failed/degraded run.
- Duration threshold.
- Cost threshold.
- Token threshold.
- Failure rate over recent runs.
- Average latency over recent runs.

Alert events:

- Create grouped incidents.
- Track status active/resolved/ignored.
- Store occurrence count and last seen time.
- Suppress repeated notifications within rule window.
- Feed Reports, Logs, notification jobs, Slack/webhooks, and safe remediation actions.

Important implementation detail:

- Metric polling skips run-source rules.
- Run ingestion skips metric-source rules.
- Both use shared duplicate-prevention/grouping logic.

### Reports / Client Proof

Reports are a major differentiator for agencies.

Features:

- Secure share links.
- Expiration and revocation.
- Signed-out read-only public report pages.
- Browser print/save-as-PDF.
- Report preview.
- Report presets.
- Brand image upload: PNG/SVG, size limited.
- Map image attachment.
- Period support: 7d, 30d, 90d, all, custom start/end.
- Optional previous-period comparison for bounded periods.
- Summary metrics: uptime, run volume, success rate, cost, tokens, quality, sample freshness, incidents.
- Active/resolved incident timeline.
- Copyable client summary text.
- CSV exports for runs, metrics, and alerts.

Safety:

- Public reports do not expose API credentials, ingestion tokens, webhook URLs, Slack URLs, signing secrets, encrypted payloads, env values, or private team details.
- Revoked/expired report pages and assets return 404.
- Assets are no-store and token-scoped.

### Integrations

Integrations is where users connect external systems.

Supported integration paths:

- Dify.
- n8n.
- GitHub Actions.
- JavaScript SDK.
- REST metrics / OpenAI/custom REST.
- Generic alert webhooks.
- Native Slack destinations.
- Safe remediation actions.

Provider-specific onboarding:

- Select node.
- Choose provider.
- Create one-time token.
- Copy setup block/snippet.
- Send test telemetry.
- Check connection evidence.
- View provider first-signal card.

SDK:

- JavaScript SDK published as `@meridian-workflows/sdk`.
- Python SDK exists in repo/package-ready but not published to PyPI yet.
- SDK docs explain trace helpers, direct run ingestion, timeouts, error hooks, and flushing for short-lived/serverless scripts.

Examples:

- `examples/live-workflow` simulates Support Triage Agent runs using published JavaScript SDK.
- `examples/dify-support-triage` gives Dify Code node and HTTP Request setup.

### Testing

Testing owns diagnostic and safe test actions.

Examples:

- Deployment readiness.
- Manual project poll.
- Test email.
- Test webhook.
- Test Slack.
- Test remediation action.
- Integration readiness.
- Endpoint setup shortcuts.
- Demo metric QA.
- Notification job recovery.
- Retention cleanup.
- Idle posture.
- Production observability.

Settings intentionally does not contain diagnostic actions.

### Logs

Logs is the unified safe operational timeline.

Sources:

- Audit logs.
- Alert events.
- Poll executions.
- Notification deliveries.
- Workflow runs.
- Reports.
- Webhooks.
- Slack.
- Team actions.
- Map saves.
- Remediation attempts.
- Billing operational evidence.
- Notification jobs.

Filters:

- Window: 24h, 7d, 30d, all.
- Type filters.
- Text search.
- Job status filters.

Safety:

- Logs never show raw tokens, secrets, encrypted payloads, provider keys, Slack URLs, webhook URLs, action URLs, or env values.

### Billing

Billing is a dedicated section separate from Logs.

Provider:

- Paddle is the current checkout/billing provider.
- Razorpay experiment was removed.
- Stripe is not used because of India availability constraints.

Billing features:

- Free/Solo/Agency/Enterprise beta plan concepts.
- USD and INR rates.
- Paddle overlay checkout.
- Paddle webhook verification.
- Server-side mirrored customers/subscriptions/transactions.
- Billing history.
- Invoice download links.
- Paddle customer portal.
- Credit packs.
- Durable credit ledger.
- Low-credit and rate-limit alerts.
- Subscription grace period.
- Provider-neutral “Refresh status”.
- Billing sync health.
- Copy support packet.

Entitlement principles:

- Browser checkout events do not grant trust by themselves.
- Verified Paddle webhooks and mirrored server state drive access.
- Paid plan transaction can grant temporary provisional access while subscription webhook catches up.
- Canceled subscriptions keep one-week grace from last known billing period end.
- Credits do not expire by time.
- Credits are consumed for overage when policy allows.

### Account

Account owns:

- Signed-in identity.
- Organization/project context.
- Team/Settings shortcuts.
- Sign out.

Sign out was intentionally moved out of the header.

### Team

Team model:

- Organization membership.
- Roles: owner, admin, member, viewer.
- Pending invitations.
- Duplicate invite dedupe.
- Role changes.
- Member removal.
- Capability matrix.
- Project access review.

Critical rule:

- At least one owner must remain.

### Settings

Settings is configuration-only.

Examples:

- Notification preferences.
- Telemetry tokens/project environment context.
- Project/environment configuration.

Testing owns test actions. Integrations owns integration setup.

### Global Search

Global header search/command palette:

- Open by clicking search, pressing Cmd/Ctrl+K, or pressing `/` outside input fields.
- Can navigate to sections, nodes, alerts, runs, reports, integrations, notification jobs, setup actions, and testing actions.
- Built from safe dashboard state only.
- Does not expose secrets.

### Interactive Tutorial

Interactive Tutorial v2:

- Guides REST metric setup.
- Highlights actual UI components.
- Does not dim the page.
- Allows app interaction while running.
- Draggable tutorial widget.
- Snaps to edge/corner.
- Can collapse to `Show tutorial ^`.
- Stores state in localStorage.
- Uses real persisted evidence only.
- Ignores sample fallback data.

Tutorial steps include:

- Open Automation Map.
- Highlight Add node.
- Confirm/select node.
- Open Integrations.
- Highlight REST metric template.
- Open API setup.
- Configure endpoint, JSONPath, test, save.
- Manual poll/check connection.
- Verify real metric evidence.
- Create report/client proof.

## Technical Architecture

### Frontend

Main technologies:

- React 19.
- Next.js 16 App Router.
- TypeScript.
- Tailwind CSS v4.
- shadcn/ui base components.
- React Flow through `@xyflow/react`.
- Apache ECharts through `echarts` and `echarts-for-react`.
- Motion for homepage animations.
- Lucide icons.

The authenticated app is mostly a large client dashboard component in `src/components/meridian/dashboard.tsx`, supported by helper modules in `src/lib`.

The Automation Map node renderer lives in `src/components/meridian/endpoint-node.tsx`.

Charts live in `src/components/meridian/charts.tsx`.

### Backend

Backend uses Next.js App Router route handlers under `src/app/api`.

Important API areas:

- Auth: `/api/auth/*`, `/api/auth/register`.
- Workspace: `/api/workspace`.
- Projects: `/api/projects`.
- Graph: `/api/projects/[projectId]/graph`, nodes, edges.
- Runs ingestion: `/api/ingest/runs`.
- REST metric config/test: node API config routes.
- Polling: `/api/cron/poll`, project manual poll route.
- Alerts: alert rules and alert event routes.
- Notification jobs: project job list/retry/cancel/recover.
- Inngest: `/api/inngest`.
- Self-hosted worker execution: `/api/runtime/notification-jobs/execute`.
- Reports: report shares, presets, public report routes.
- Exports: runs/metrics/alerts CSV.
- Logs: `/api/projects/[projectId]/logs`.
- Billing: `/api/billing`, Paddle webhook, invoice, portal.
- Slack/webhooks/remediation action management.
- Health: `/api/health`.

### Database

Database:

- Postgres through Neon in current hosted production.
- Prisma ORM.
- Prisma Client generated during build.

The production database was migrated from a Vercel-managed Neon resource to an independently managed Neon project named Meridian. The app prefers `NeonDB_POSTGRES_PRISMA_URL` when present, otherwise `DATABASE_URL`; docs warn not to leave both incorrectly configured after migration.

### Auth

Auth stack:

- Auth.js / NextAuth.
- Prisma adapter models.
- GitHub OAuth.
- Google OAuth.
- Email/password registration.

Email/password:

- `UserPasswordCredential`.
- Salted `scrypt` password hashes.
- Raw passwords are never stored or logged.

Workspace bootstrap:

- First-login flow creates a personal organization.
- Can seed a demo project once per new workspace.

### Runtime / Environments

Runtime modes:

```env
MERIDIAN_DEPLOYMENT_MODE=cloud | self_hosted
MERIDIAN_EDITION=cloud | community | enterprise
MERIDIAN_BILLING_MODE=paddle | disabled | license
MERIDIAN_JOB_BACKEND=inngest | self_hosted | manual
```

Hosted cloud default:

- Deployment mode: cloud.
- Edition: cloud.
- Billing: Paddle.
- Job backend: Inngest.

Self-hosted community default:

- Deployment mode: self_hosted.
- Edition: community.
- Billing: disabled.
- Job backend: self_hosted.

Compatibility:

- `MERIDIAN_JOB_BACKEND` is preferred.
- `MERIDIAN_DEFAULT_JOB_BACKEND` remains accepted as fallback.

Runtime info is exposed safely in `/api/health` and Testing readiness. It never exposes secrets.

### Deployment

Current hosted deployment:

- Vercel.
- Canonical domain: `https://meridian.hrudainirmal.in`.
- GitHub Actions CI.
- Manual production smoke workflow.
- Prisma migrations before production release.
- Release safety script.
- Smoke test script.

Release commands:

```bash
npm run prisma:deploy
npm run release:check
SMOKE_BASE_URL="https://meridian.hrudainirmal.in" SMOKE_REQUIRE_READY=1 npm run test:smoke
```

### CI / Safety Gates

CI checks:

- `npm ci`.
- Prisma client generation.
- Typecheck.
- ESLint.
- Production build.
- SDK verification.
- Demo verification.

Manual production smoke:

- Checks public routes.
- Checks health readiness.
- Checks secret-safety.
- Can optionally run authenticated and mutation smoke with Playwright storage state.

Health route:

- Includes build version, commit, build time, environment.
- Separates database connectivity from schema compatibility.
- Reports safe issue metadata.

## Data Model Overview

Important enums:

- `MembershipRole`: OWNER, ADMIN, MEMBER, VIEWER.
- `EndpointStatus`: ACTIVE, DEGRADED, DOWN, UNKNOWN.
- `EdgeKind`: VISUAL.
- `ApiAuthType`: NONE, API_KEY_HEADER, BEARER_TOKEN, BASIC, CUSTOM_HEADERS.
- `VisualizationKind`: NUMBER, LINE, BAR, TABLE, STATUS, ALERT_LIST, HEATMAP, SANKEY, CORRELATION, FORECAST.
- `AlertSeverity`: INFO, WARNING, CRITICAL.
- `NotificationJobStatus`: QUEUED, RUNNING, RETRYING, SENT, FAILED, SKIPPED, CANCELLED.

Major models:

- `RuntimeSetting`: runtime-level job/backend settings.
- `User`: authenticated user.
- `UserPasswordCredential`: email/password hash record.
- `Account`, `Session`, `VerificationToken`: Auth.js models.
- `Organization`: team/workspace container.
- `Membership`: user role in organization.
- `TeamInvitation`: pending invites.
- `Project`: operational workspace.
- `ProjectOperationsPolicy`: per-project operations, polling, retention, spend behavior.
- `PaddleCustomer`, `PaddleSubscription`, `PaddleTransaction`, `PaddleWebhookEvent`: billing mirror.
- `BillingCreditLedgerEntry`: durable credit grants/consumption.
- `ProjectCategory`: grouping for nodes.
- `EndpointNode`: Automation Map node.
- `GraphEdge`: visual edge.
- `NodeIcon`: custom icon asset.
- `NodeStatusOverride`: manual status override.
- `ApiEndpointConfig`: REST metric endpoint config.
- `ProjectSecret`: encrypted project secret payloads.
- `IngestionToken`: hashed telemetry token.
- `IngestionRateLimitBucket`: durable rate limiting.
- `ProjectWebhookDestination`: generic signed webhook destination.
- `ProjectSlackDestination`: encrypted Slack incoming webhook destination.
- `ProjectRemediationAction`: signed remediation/runbook action config.
- `ReportShare`: secure public report link.
- `ReportPreset`: reusable report defaults.
- `ParameterMapping`: JSONPath metric mappings.
- `VisualizationConfig`: visual config.
- `WorkflowRun`: submitted workflow run.
- `WorkflowStep`: steps inside workflow run.
- `MetricSample`: raw REST metric sample.
- `MetricRollup`: aggregated metrics.
- `PollExecution`: polling job evidence.
- `AlertRule`: metric or run alert rule.
- `AlertEvent`: incident.
- `RemediationActionAttempt`: action delivery evidence.
- `NotificationPreference`: per-user preferences.
- `AlertNotificationDelivery`: email/webhook/Slack evidence.
- `NotificationJob`: durable outbox job.
- `AuditLog`: safe audit trail.

## Core Flow: Sign-In And Workspace Bootstrap

1. User visits `/`.
2. If signed out and app healthy, user sees homepage.
3. User signs in with GitHub, Google, or email/password.
4. Auth.js creates/loads user/account/session.
5. Workspace bootstrap creates organization/membership if needed.
6. User lands in dashboard.
7. Dashboard defaults to Automation Map unless tutorial auto-start chooses another section.

Failure handling:

- Missing DB/auth config shows setup/service-unavailable screen.
- Database/auth errors are logged safely with incident IDs.
- OAuth is blocked if session persistence is unavailable.

## Core Flow: Project And Graph Editing

1. Owner/admin/member creates or selects project.
2. User opens Automation Map.
3. In Edit mode, user creates nodes, drags them, adds links, edits labels.
4. Client sends graph/node/edge changes to project graph APIs.
5. Server checks project role/capability.
6. Server persists graph state.
7. Audit evidence is written for key graph saves.
8. Dashboard refresh/live signal updates state.

Permissions:

- Owners/admins generally have full control.
- Members can perform allowed project setup/editing actions.
- Viewers are blocked from mutations.

## Core Flow: REST Metric Setup

1. User selects a node.
2. User opens Setup/API setup.
3. User chooses endpoint URL.
4. User chooses auth type if needed.
5. User enters auth header and secret if authenticated.
6. User defines primary metric, unit, JSONPath mapping, transform, and threshold.
7. User tests endpoint.
8. Server fetches endpoint using safe request handling.
9. Test result shows status, JSON preview, mapped values, threshold preview.
10. User saves setup.
11. User manually polls or enables scheduled polling.
12. Metric samples persist.
13. Node metrics, freshness, trend charts, alerts, and reports update.

Secret handling:

- API credentials are encrypted before storage.
- Secret values are not returned to client after saving.
- Logs/reports/exports never show credentials.

## Core Flow: Workflow Telemetry Ingestion

1. Owner/admin creates project-scoped ingestion token.
2. Raw token is shown once.
3. Token hash/prefix metadata is stored.
4. External workflow posts to `/api/ingest/runs`.
5. Server validates token and node/project.
6. Server enforces rate limits and billing entitlement.
7. Server persists `WorkflowRun` and `WorkflowStep`.
8. Server evaluates run-source alert rules.
9. Server queues notification jobs if needed.
10. Dashboard runs tab, node cards, logs, reports, and live signals update.

Supported clients:

- Dify.
- n8n.
- GitHub Actions.
- JavaScript SDK.
- Python SDK preview.
- Raw REST.

## Core Flow: Alert Evaluation

Metric polling path:

1. Poll due REST endpoint.
2. Store metric samples.
3. Evaluate metric-source alert rules.
4. Skip run-source rules.
5. Create/update grouped incidents.
6. Queue notification jobs if notification window allows.

Run ingestion path:

1. Persist workflow run.
2. Evaluate run-source alert rules.
3. Skip metric-source rules.
4. Create/update grouped incidents.
5. Queue notification jobs.

Noise reduction:

- Duplicate unresolved incidents are grouped.
- Occurrence count and lastSeenAt are updated.
- Repeat notifications respect suppression window.

## Core Flow: Durable Notification Jobs

Meridian uses a Postgres outbox pattern.

1. Alert lifecycle transaction creates alert evidence and notification jobs.
2. One job per recipient/destination is stored.
3. Job stores safe references, not secrets.
4. Inngest receives only job id and generation.
5. Worker loads job from DB.
6. Worker sends email/Slack/webhook using encrypted destination/provider config.
7. Delivery evidence is updated.
8. Job becomes SENT, FAILED, SKIPPED, CANCELLED, etc.

Inngest behavior:

- Event-driven processing.
- Five total attempts with backoff.
- Failure handler.
- Scheduled recovery off by default to reduce idle cost.
- Manual recovery available in Testing.

Self-hosted bridge:

- `runtime_settings.job_backend` can select `inngest`, `self_hosted`, or `manual`.
- Self-hosted dispatch posts job id/generation to a laptop worker.
- Worker calls authenticated `/api/runtime/notification-jobs/execute`.
- Existing notification send path is reused.
- Worker URL and secret are required in self-hosted mode.
- Docker Compose packaging is a next slice.

Idempotency:

- Stable job IDs.
- Stable Resend idempotency keys.
- Stable webhook delivery IDs.
- Slack remains at-least-once if timeout makes outcome unknowable.

## Core Flow: Generic Webhooks

1. Owner/admin creates destination.
2. URL and signing secret are handled safely.
3. Signing secret is shown once.
4. Alerts queue webhook jobs.
5. Worker signs raw JSON payload.
6. Receiver verifies HMAC.
7. Delivery status appears in alert detail and Logs.

Headers:

- `X-Meridian-Event`.
- `X-Meridian-Delivery`.
- `X-Meridian-Timestamp`.
- `X-Meridian-Signature`.

Signature:

- HMAC SHA-256 over timestamp plus raw JSON body.

## Core Flow: Slack Alerts

1. Owner/admin creates Slack destination with Slack incoming webhook URL.
2. URL is encrypted and never shown again.
3. Destination has enabled state, minimum severity, and event filters.
4. Alerts queue Slack jobs.
5. Worker sends Block Kit message.
6. Delivery evidence is stored.

Skipped cases:

- Disabled destination.
- Severity below threshold.
- Event not in filters.
- Deleted destination.

## Core Flow: Safe Remediation Actions

Remediation actions let Meridian call external runbook endpoints when incidents happen.

Examples:

- Pause intake.
- Disable workflow.
- Scale down worker.
- Trigger rollback.
- Custom webhook.

Safety controls:

- Owner/admin only.
- HTTPS endpoint required.
- Signing secret shown once.
- Manual approval or automatic-on-alert mode.
- Severity gates.
- Event filters.
- Cooldown.
- Dry-run test action.
- Logs hide action URL and secrets.

Automatic remediation is opt-in and only triggers on newly opened matching incidents, not grouped repeats.

## Core Flow: Client Proof Reports

1. Owner/admin opens Reports.
2. User fills title, client name, subtitle, prepared by, executive note.
3. User chooses/report preset.
4. User chooses period: 7d, 30d, 90d, all, custom.
5. User toggles comparison if bounded period.
6. User optionally attaches brand image and map PNG.
7. User previews.
8. User creates share link.
9. Client opens public signed-out report.
10. User can revoke/expire report.

Data included:

- Node summaries.
- Runs.
- Metrics.
- Alerts/incidents.
- Cost/tokens/quality.
- Period/comparison labels.
- Map/brand assets.

Data excluded:

- Secrets.
- Tokens.
- Credentials.
- Private team data.
- Encrypted payloads.

## Core Flow: Billing And Entitlements

Checkout:

1. User opens Billing.
2. User chooses plan or credit pack.
3. Paddle checkout opens.
4. Paddle sends signed webhook.
5. Server verifies webhook.
6. Server mirrors customer/subscription/transaction.
7. Entitlements update.
8. Billing UI shows plan/history/invoices/credits.

Usage enforcement:

- Workflow-run ingestion.
- Metric-sample persistence.
- Notification jobs.
- Report-share creation.

Spend behavior:

- `stop_at_plan`: deny overage.
- `use_credits`: consume prepaid credits.

Support:

- `Refresh status`.
- Billing sync health.
- Billing support packet.
- Billing alerts.

## Security Model

### RBAC

Roles:

- Owner.
- Admin.
- Member.
- Viewer.

Protected areas:

- Team management.
- Project mutations.
- Token management.
- Report management.
- CSV exports.
- Integrations management.
- Slack/webhooks/remediation.
- Billing operations.
- Notification job retry/cancel.
- Production observability.

Viewer restrictions:

- View project evidence but cannot mutate sensitive setup.

### Secret Handling

Patterns:

- Ingestion tokens are hashed and shown once.
- API credentials encrypted before storage.
- Slack incoming webhook URLs encrypted.
- Generic webhook secrets shown once.
- Remediation action secrets shown once.
- Public reports/exports/logs omit secrets.
- Health route redacts env/secrets.
- Billing support packet is provider-neutral and safe.

### HMAC And Signature Verification

Used for:

- Generic outbound webhooks.
- Safe remediation actions.
- Paddle inbound webhooks.

Principles:

- Sign exact raw body when required.
- Include timestamp/delivery ID.
- Verify using constant-time comparisons where relevant.
- Do not mark paid or delivered unless signature checks pass.

### Public Pages

Public report links:

- Token-scoped.
- Read-only.
- Expirable.
- Revocable.
- No-store.
- Secret-safe.

### Browser Hardening

Security headers:

- `X-Content-Type-Options`.
- `Referrer-Policy`.
- `Permissions-Policy`.
- `X-Frame-Options`.
- HSTS.

Smoke tests verify these for app shell and health.

## Reliability Model

### Health Checks

`/api/health` checks:

- Database.
- Schema compatibility.
- Auth configuration.
- Encryption.
- Cron secret presence.
- Email config.
- Durable job config.
- Latest poll.
- Latest delivery.
- Notification job counts.
- Build metadata.
- Runtime metadata.

### Release Safety

Release safety protects against deploying code that expects a schema not yet migrated.

Flow:

1. Deploy migrations.
2. Run release check.
3. Run smoke test.
4. Run manual production smoke workflow after Vercel deployment.

### Zero-Idle Defaults

Meridian learned from Neon/Inngest idle-cost issues.

Defaults:

- No Vercel cron schedule.
- cron-job.org disabled unless active pilot needs REST polling.
- Dashboard SSE live mode manual.
- Scheduled Inngest recovery off.
- Retention cleanup manual.
- External side effects disabled outside production unless explicit opt-in.

Manual controls:

- Poll project now.
- Recover queued jobs now.
- Run retention cleanup now.
- Go live / Pause live.

### Polling Safety

Polling is due-work based, not “poll everything every minute.”

Optimizations:

- Atomic due-work claims.
- Batch cap.
- Skip poll-history writes when no work is due.
- Per-node cadence.
- Manual project polling for demos.

### Data Scale Safety

CSV exports:

- Default 30d window.
- Default 5,000 row cap.
- 10,000 hard cap.
- Truncation headers.

Logs:

- Limit param max.
- Metadata includes returned/truncated/window.

Retention:

- Raw runs/metrics default retention.
- Rollups for history.
- Cleanup manual by default.

Rate limits:

- Durable ingestion rate buckets.
- Retry-after behavior.
- Billing/rate-limit alerts.

## Self-Hosting Strategy

Meridian is evolving toward a hosted + self-hosted model.

Planned levels:

1. Meridian Cloud.
2. Community self-hosted.
3. Enterprise self-hosted / licensed.

Current foundation:

- Runtime flags.
- Billing disabled/license modes.
- Job backend selectable.
- Self-hosted notification bridge.
- Health/runtime labels.
- Billing UI disables hosted Paddle checkout in self-hosted/community mode.

Next self-hosting work:

- Docker Compose for Postgres and worker.
- Admin portal for runtime settings.
- Local durable worker container.
- Backup/restore scripts.
- Setup docs for Windows laptop deployment.
- Optional hosted license/enterprise sync later.

Important product stance:

- Prevent misuse primarily through hosted value, updates, support, enterprise features, and licensing, not hostile DRM.
- Community edition should be useful but not give away enterprise/cloud monetization levers.

## Marketing Strategy For Self-Hosted Meridian

Meridian can be marketed as:

- Cloud when teams want low setup and managed reliability.
- Self-hosted when teams want data control, private network deployments, or cost control.
- Agency-friendly because it creates client proof.
- Developer-friendly because SDK/API telemetry is open and simple.

Avoid framing:

- Do not make self-hosting look like a second-class hack.
- Do not overpromise enterprise procurement readiness until SSO/audit/data-retention controls mature further.

## Pricing And Business Model

Current thinking:

- Conservative starting prices because early customer base will be small.
- Free/starter tier needs strict usage caps.
- Paid plans include usage.
- Credit packs cover accidental overage.
- Subscription usage expires with plan; purchased credits do not expire by time.
- One-week grace period after subscription cancellation.

Why credits help:

- Prevent abrupt breakage when a customer exceeds plan.
- Protect Meridian from unlimited free usage.
- Give transparent overage control.

Risks:

- Too generous free tier can create infrastructure costs.
- Inngest/Neon idle costs taught that default background behavior matters.
- Billing/provider sync must be reliable so paid users do not lose access.

## Operational Policies

Project-specific operations policy controls:

- Polling cadence.
- Retention days.
- Spend behavior.
- Notification reliability posture.

Some runtime-level behavior is centrally controlled:

- Inngest recovery mode.
- Retention cleanup schedule.
- Runtime job backend.
- Self-host/cloud mode.

This distinction matters:

- Customers/projects can control operational preferences.
- Platform owner controls global infrastructure cost and worker posture.

## Important Technical Modules

Selected `src/lib` modules:

- `access-policy`: role/capability rules.
- `alert-events`: incident creation/resolution helpers.
- `alert-rule-metadata`: rule metadata parsing.
- `alert-rule-templates`: metric/run templates.
- `api-auth-headers`: endpoint auth header construction.
- `api-setup-help`: field guidance for API setup.
- `app-version`: build metadata.
- `audit-log`: safe audit rows.
- `auth`: Auth.js config.
- `billing-entitlements`: plan/credit entitlement logic.
- `billing-notifications`: billing alert emails.
- `billing-plans`: plan/credit definitions.
- `billing-support`: support packet.
- `crypto`: encryption/signing helpers.
- `csv`: CSV helpers.
- `global-search`: command palette index/search.
- `health`: readiness checks.
- `ingestion-rate-limits`: rate-limit buckets.
- `ingestion-tokens`: hashed token creation/verification.
- `integration-templates`: provider templates.
- `integration-wizard`: guided setup.
- `job-service`: Inngest/self-host/manual backend dispatch.
- `notification-jobs`: outbox creation/execution.
- `notifications`: email delivery.
- `operations-policy-enforcement`: usage/spend policies.
- `paddle-*`: checkout, billing, webhook, server helpers.
- `polling`: REST metric polling.
- `production-observability`: Testing overview cards.
- `project-live`: SSE signal behavior.
- `project-usage`: usage graphs.
- `remediation-actions`: signed runbook actions.
- `report-*`: assets, periods, client proof.
- `rest-metric-onboarding`: first metric evidence.
- `retention-cleanup`: cleanup jobs.
- `run-alert-rules`: workflow-run alert rules.
- `run-metrics`: persisted run-derived summary cards.
- `runtime-config`: cloud/self-host/billing/job mode.
- `runtime-environment`: production/preview/local side-effect policy.
- `safe-metadata-format`: safe log metadata rendering.
- `sdk-onboarding`: SDK snippets.
- `server-logging`: structured incident-safe logs.
- `slack`: Slack delivery.
- `telemetry-evidence`: real vs sample evidence.
- `tutorial`: tutorial state/progress.
- `webhooks`: generic webhook delivery.
- `workspace`: dashboard payload.

## API Surface Summary

Important routes:

- `GET /`: signed-out homepage or signed-in dashboard.
- `GET /api/health`: safe readiness.
- `POST /api/auth/register`: email/password registration.
- `GET/POST /api/projects`: project list/create.
- `GET/PATCH /api/projects/[projectId]`: project detail/update/archive.
- `POST /api/projects/[projectId]/graph`: autosave graph.
- Node/edge CRUD routes.
- `POST /api/ingest/runs`: workflow telemetry ingestion.
- `GET /api/cron/poll`: secured due-work poll dispatcher.
- `POST /api/projects/[projectId]/poll/run`: manual project poll.
- Alert rule CRUD.
- Notification job list/detail/retry/cancel/recover.
- Logs route.
- Usage route.
- Operations overview/policy routes.
- Report shares/presets/routes/assets.
- CSV export routes.
- Webhook/Slack/remediation CRUD/test routes.
- Billing, invoice, portal, Paddle webhook.
- `GET|POST|PUT /api/inngest`: worker endpoint.
- `POST /api/runtime/notification-jobs/execute`: self-hosted worker executor.

## Integration Examples

### Direct REST Run Ingestion

External workflow posts:

```json
{
  "nodeId": "endpoint-node-id",
  "externalId": "run_001",
  "status": "success",
  "startedAt": "2026-06-12T09:30:00.000Z",
  "finishedAt": "2026-06-12T09:30:02.400Z",
  "costUsd": 0.042,
  "tokens": 1280,
  "steps": [
    {
      "name": "Fetch context",
      "status": "success",
      "latencyMs": 420,
      "toolName": "database"
    }
  ]
}
```

Authorization:

- `Authorization: Bearer <ingestion-token>`.

### Dify Integration Pattern

Dify workflow:

- User input.
- Knowledge retrieval.
- LLM.
- Answer.
- Code node builds Meridian run payload.
- HTTP Request node posts to Meridian.

Dify limitations learned:

- Some system variables may not exist.
- Code node input arguments must match function signature.
- Node ID can be hidden/prefilled.
- Cost/token usage may need estimates unless Dify exposes exact usage variables.
- Meridian UI now uses actual persisted run values for node summary cards.

### REST Metric Integration Pattern

External API returns JSON:

```json
{
  "value": 95,
  "latencyMs": 240,
  "status": "ok"
}
```

Mapping:

- Primary metric JSONPath: `$.value`.
- Unit: `score`.
- Threshold: `> 90`.

Then manual poll persists real metric sample and can open alert.

## What Meridian Does Not Yet Do

Current limitations:

- Edges are visual, not execution dependencies.
- No full multi-user real-time collaborative editing.
- No SSO/SAML yet.
- No full enterprise procurement checklist yet.
- Python SDK not published to PyPI yet.
- Self-hosted Docker packaging not complete.
- Forecast/correlation/Sankey views are deferred.
- Server-side PDF generation deferred; reports use browser print/save-as-PDF.
- Preview environment isolation deferred until separate DB/Inngest environment exists.
- Durable worker currently uses Inngest/cloud or the first self-hosted bridge, but full local worker packaging is next.

## Key Engineering Tradeoffs

### Why Graph-First?

Because agencies think in workflows and client systems. A map gives immediate context: what exists, what depends on what, and where failures happen.

Tradeoff:

- It is more complex than a table-first monitoring UI.
- But it becomes a strong differentiator and makes client proof visual.

### Why Not Build The Workflow Engine?

Meridian monitors existing workflow systems instead of replacing them.

Benefits:

- Easier adoption.
- Compatible with Dify/n8n/GitHub Actions/custom code.
- Lower execution liability.

Tradeoff:

- Meridian depends on integrations/telemetry rather than controlling execution.

### Why Postgres Outbox + Inngest?

Inline notification sending caused reliability risks. Durable jobs:

- Preserve evidence.
- Retry transient failures.
- Avoid losing notifications when provider calls fail.
- Keep alert transaction separate from external delivery.

Tradeoff:

- More tables and complexity.
- Inngest can create cost if scheduled functions are careless.

### Why Zero-Idle Defaults?

The project hit Neon and Inngest usage surprises while idle. Meridian now defaults to manual/explicit background work.

Tradeoff:

- Less “always live” by default.
- But far safer for solo/private-beta operation and self-hosting.

### Why Paddle?

Stripe invite limitations in India and Razorpay sandbox issues led to Paddle.

Benefits:

- Merchant-of-record model.
- Subscription support.
- International SaaS orientation.

Tradeoff:

- More webhook/mirroring complexity.
- UI needs careful support states so paid users do not get stuck.

### Why Public Reports Instead Of Client Portal First?

Reports solve immediate agency proof needs faster.

Benefits:

- Easy to share.
- No client account required.
- Secret-safe read-only token route.

Tradeoff:

- Not a full customer portal yet.

## Interview Talking Points

### Product

Strong answer:

> Meridian is an AI automation control room. The insight is that agencies do not only need to build automations; they need to prove to clients that those automations are reliable, cost-effective, and improving outcomes. Meridian sits beside tools like Dify, n8n, GitHub Actions, and custom scripts. It ingests runs, polls metrics, detects incidents, sends notifications, and creates branded client proof reports.

### Architecture

Strong answer:

> The architecture is Next.js App Router with route handlers as the backend, Prisma/Postgres as the system of record, React Flow for the Automation Map, ECharts for analytics, Auth.js for identity, Inngest plus Postgres outbox for durable notification jobs, Paddle for billing, and Vercel for hosted deployment. The database is the source of truth; workers only receive job IDs or safe references.

### Reliability

Strong answer:

> I avoid inline provider delivery for notifications. Alert changes transactionally create jobs in Postgres. Inngest or a self-hosted worker processes those jobs with retries and updates delivery evidence. Recovery is manual or opt-in to avoid idle cost. Health checks separate database connectivity from schema compatibility, and production release uses migrations, release checks, and smoke tests.

### Security

Strong answer:

> The app assumes operational data can be sensitive. Ingestion tokens are shown once and stored hashed. API credentials and Slack URLs are encrypted. Webhook/remediation secrets are one-time. Logs, reports, exports, health checks, and public pages are secret-safe. RBAC gates mutations. Public report links are token-scoped, revocable, no-store, and never include credentials or private team data.

### Billing

Strong answer:

> Billing trusts verified server-side Paddle webhooks, not browser checkout events. It mirrors customers, subscriptions, transactions, and credit ledger entries. Plans provide included usage; credits cover overage if policy allows. Canceled subscriptions get a grace period, paid transactions can provide provisional access while webhooks catch up, and Billing has support packets and sync health for customer issues.

### Self-Hosting

Strong answer:

> Meridian is moving toward cloud plus self-hosted. The first foundation is runtime mode flags, billing mode flags, job backend selection, health visibility, and a self-hosted notification bridge. The next slice is Docker Compose for Postgres and a local worker. Self-hosting is not only cost control; it also supports data-control customers, but cloud remains the easiest managed path.

## Likely Interview Questions And Strong Answer Notes

### What problem does Meridian solve?

Meridian solves operational proof for AI automations. Builders can show whether workflows are running, failing, getting slower, costing more, consuming more tokens, or creating incidents. Agencies can turn that evidence into client reports.

### Why is the Automation Map useful?

It gives users a mental model of their automation estate. A table can show incidents, but a map shows systems, dependencies, and client-facing workflows. It also makes reports more understandable.

### How does telemetry ingestion work?

Users create a project-scoped token. The token is shown once and stored hashed. External workflows post run payloads to `/api/ingest/runs`. The server validates token, checks rate limits and billing, persists run/steps, evaluates run-source alert rules, queues notification jobs, and updates dashboard/report evidence.

### How does REST metric polling work?

Each node can store encrypted endpoint config and JSONPath mappings. Polling fetches due endpoints, extracts mapped values, stores metric samples, evaluates metric-source alert rules, creates grouped incidents, and updates rollups. Scheduled polling is off by default; manual polling remains available.

### How are duplicate alerts prevented?

Alert rules create grouped incidents. If the same rule/source breaches while an unresolved incident exists, Meridian updates occurrence count and lastSeenAt instead of creating another unresolved alert. Notification repeat is controlled by suppression window.

### How are notifications reliable?

Alert lifecycle writes notification jobs to Postgres in the same transaction as alert evidence. Workers process jobs and update delivery status. Jobs store safe references, not raw secrets. Inngest handles retries; manual recovery handles rare dispatch failures. Self-hosted bridge can reuse the same execution route.

### How do client reports stay secret-safe?

Report payloads are built from safe summaries, not raw configs. Public routes are token-scoped and check revoked/expired state. Assets are served through token routes. Reports exclude tokens, API secrets, Slack/webhook URLs, encrypted payloads, env values, and private team details.

### What did you do after hitting Neon/Inngest limits?

Meridian adopted zero-idle defaults: no default cron, manual dashboard live mode, scheduled Inngest recovery off, manual retention cleanup, due-work polling, lower-frequency signals, and explicit operator controls. The app now treats background work as a customer/pilot decision, not a default.

### Why use Inngest instead of just cron?

Cron is time-triggered and can cause idle usage. Inngest is event-driven for notification jobs and gives retries/failure handling. Scheduled Inngest functions are kept off by default. For self-hosting, Meridian is adding a local worker option.

### How would Meridian scale to enterprise pilots?

App-level scale controls already exist: bounded exports, query limits, retention, rate limiting, role enforcement, durable jobs, secret-safe logs, release gates, and health checks. Infrastructure scaling would involve managed Postgres capacity, queue/worker capacity, observability, backup strategy, and potentially isolated environments.

### What is the biggest current risk?

The biggest risks are integration setup complexity, billing/provider sync correctness, and self-hosted packaging maturity. Meridian mitigates these with guided onboarding, support evidence, provider-neutral billing health, safe logs, and step-by-step self-hosting milestones.

### What would you build next?

Next likely milestones:

- Docker Compose self-hosting package with Postgres and worker.
- Admin portal for runtime/job/backend controls.
- Stronger onboarding for Dify/n8n/SDK paths.
- SSO/SAML for enterprise.
- More complete self-hosted licensing model.
- More advanced analytics once enough real usage data exists.

## Deep-Dive Areas To Be Ready For

### Explain The Database As Source Of Truth

Meridian treats Postgres as the ground truth:

- Runs, metrics, alerts, jobs, reports, billing, logs, team, and config are persisted.
- Workers receive safe references like job id/generation.
- Public pages render from DB state.
- Billing entitlements derive from mirrored verified provider state.
- Recovery is possible because queued jobs remain in Postgres.

### Explain Idempotency

Examples:

- Notification jobs use stable job ID/generation.
- Resend gets stable idempotency key.
- Webhook delivery IDs are stable.
- Paddle webhook events are processed idempotently.
- Report/share/token actions write audit evidence.
- Duplicate alert breaches update grouped incidents.

### Explain Secret-Safe Design

Meridian has many potentially sensitive integrations. The safety rule is: operational evidence can be visible, credentials cannot.

Patterns:

- Store hashes instead of raw tokens.
- Encrypt provider URLs/secrets.
- Show secrets once.
- Only return prefixes or metadata later.
- Scrub logs/reports/exports.
- Keep public pages read-only and token-scoped.

### Explain The Difference Between Metrics And Runs

Metrics:

- Numeric samples from polled REST APIs.
- Good for uptime, latency, queue depth, score, external status.
- Evaluated during polling.

Runs:

- Workflow executions submitted by SDK/API integrations.
- Include status, duration, cost, tokens, steps.
- Evaluated during ingestion.

Both feed:

- Node health.
- Alerts.
- Reports.
- Logs.
- Billing/usage.

### Explain The Role Of `Testing`

Testing is not user settings. It is an operator console:

- Confirm deployment readiness.
- Run manual poll.
- Test notifications.
- Run integration QA.
- Recover jobs.
- Clean retention.
- View idle posture and production observability.

This separation keeps Settings clean and reduces operational confusion.

### Explain Why Logs Are Separate From Billing History

Logs are operational timeline. Billing history is financial/customer support evidence. Mixing them makes support and audit confusing. Billing history includes transactions/invoices/credit ledger; Logs contain operational actions and safe billing confirmation evidence only.

## Suggested Practice Drill

Ask ChatGPT to challenge you on these:

1. Draw Meridian’s architecture from browser to database to worker to external providers.
2. Explain exactly what happens when a Dify workflow posts a run.
3. Explain exactly what happens when a REST metric breaches a threshold.
4. Explain how Meridian avoids duplicate notifications.
5. Explain why scheduled recovery is off by default.
6. Explain how a public report can be useful but safe.
7. Explain how billing prevents paid users from getting stuck after checkout.
8. Explain how self-hosting changes job execution and billing.
9. Explain the difference between project operations policy and runtime backend policy.
10. Explain what you would do if a customer says “I paid but my plan did not activate.”
11. Explain what you would do if Neon usage spikes with no users.
12. Explain what you would do if Inngest shows thousands of idle executions.
13. Explain how RBAC is enforced and why viewers cannot mutate integrations.
14. Explain the tradeoff between visual graph relationships and actual orchestration.
15. Explain which enterprise features are still missing and how you would add them.

## Concise Interview Summary

Meridian is a full-stack AI automation observability and client-proof platform. It uses Next.js App Router, React, React Flow, Prisma, Postgres, Auth.js, Inngest, Paddle, Slack/webhooks, and SDK/API integrations. The core system models organizations, projects, nodes, metric samples, workflow runs, alert rules, alert events, notification jobs, reports, billing entitlements, and audit logs. It emphasizes operational reliability, secret-safe evidence, zero-idle cost control, and agency-ready client reporting. The current product is ready for private-beta style pilots and is moving toward a cloud plus self-hosted deployment strategy.
