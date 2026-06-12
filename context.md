# ArgusGrid Context

## Project Purpose
ArgusGrid is a PC-first AI automation control room for agencies and teams. The product is graph-first: each project opens to a visual automation map where nodes represent user-labelled services, APIs, tools, or automation endpoints. Selecting a node opens a dashboard inspector for health, runs, cost, latency, quality, alerts, and API parameter mappings. The strategic buyer focus is AI automation agencies that need to prove reliability and ROI to clients, with in-house AI ops teams as the secondary segment.

## Current Implementation State
- Scaffolded with Next.js App Router, TypeScript, Tailwind CSS v4, and shadcn/ui base components.
- Added React Flow for the endpoint graph and Apache ECharts for analytics visuals.
- Added Auth.js GitHub OAuth with Prisma adapter models for users, accounts, sessions, and verification tokens.
- Added database-backed organization, membership, project, category, endpoint node, graph edge, status override, and endpoint metadata loading.
- Added first-login workspace bootstrap that creates a personal organization and can seed the "Support Automation Grid" demo project exactly once per new workspace.
- Added autosaved React Flow graph state for node positions, node basics, visual edges, endpoint metadata, and node status overrides.
- Added authenticated route handlers for workspace bootstrap, project list/detail loading, graph autosave batches, and direct node/edge CRUD.
- Added Neon-ready environment docs, `.env.example`, Prisma generation/migration scripts, and an idempotent seed command.
- Added deployed-first onboarding, project create/rename/archive controls, team member/invitation UI, encrypted API configuration, cron polling, metric sample persistence, hourly rollups, and in-app alert resolution.
- Added private-beta team completion: pending invitations are accepted on matching GitHub login, owners/admins can manage member roles and pending invitations, and viewers are blocked from project mutations.
- Added guided API setup testing with endpoint response status, JSON/non-JSON preview, JSONPath mapping results, transform output, and threshold preview.
- Added project-level alert center filters, alert detail drawer, optional Resend email notifications for newly created alerts, persisted email delivery logs, owner/admin test-email action, and per-user email notification preferences.
- Added compact alert-rule management for persisted node parameter mappings, including severity, threshold expression, enabled state, and source labeling for threshold-driven node health.
- Added DB-backed custom PNG/SVG node icon uploads with size and MIME validation.
- Added secured Vercel cron configuration for `/api/cron/poll`; Hobby-compatible schedule is daily.
- Added safe deployed readiness checks through `/api/health`, dashboard deployment diagnostics, poll execution logging, duplicate-alert prevention, non-JSON polling tolerance, and raw metric sample retention cleanup.
- Added owner/admin manual project polling for demos, a deterministic demo metric endpoint, and a dashboard shortcut for configuring a known threshold-breach metric.
- Added real metric dashboards in the node inspector: workspace payloads now include recent `MetricSample` values, hourly `MetricRollup` trend data, freshness labels, threshold context, and seeded visuals only act as fallback when no persisted samples exist.
- Added workflow run telemetry ingestion: project-scoped hashed ingestion tokens, generic `/api/ingest/runs` webhook, persisted `WorkflowRun`/`WorkflowStep` details, and a Runs tab that shows real submitted runs with seeded fallback only when no telemetry exists.
- Added basic and advanced integration templates for Dify, n8n, GitHub Actions, and OpenAI/custom REST metrics. Templates prefill metric setup fields or provide copyable telemetry snippets with selected node ids and token placeholders.
- Reduced inspector crowding by moving integration templates, API setup, and alert-rule editing into focused dialogs; widened Deployment readiness into a scrollable viewport-safe dialog; added an in-place Refresh runs action for workflow telemetry.
- Replanned the product around the "AI automation control room" positioning: graph-first map, AI value monitoring, reliable alerts, agency client reports, and open-source SDK instrumentation as the growth loop.
- Added secure client-facing report links with public read-only report pages, expiry/revocation support, agency-friendly summary metrics, and no secret exposure.
- Added client-side PNG export for the current project map so agencies can include visual automation maps in stakeholder reports.
- Added Python and JavaScript SDK previews in `sdk/python` and `sdk/js`, plus `docs/sdk.md`, using the existing `/api/ingest/runs` telemetry contract.
- Focused integration template breadth around Dify, n8n, GitHub Actions, and OpenAI/custom REST instead of broad generic template sprawl.
- Added visual polish for the deployed dashboard: neutral black/grey dark mode tokens, clearer React Flow dot grid visibility, and edit-mode node snapping to the nearest 22px grid point on drag release.
- Added premium Control Room information architecture: real sidebar sections for Control Room, Automation Map, Runs, Alerts, Reports, Integrations, Team, and Settings; Control Room now summarizes node health, run success, active alerts, poll/email readiness, cost, metric streams, and attention items.
- Moved project-level runs, alerts, reports, integration templates, team management, and deployment/telemetry settings into first-class section views while preserving the graph-first Automation Map and existing API behavior.
- Cleaned up the selected-node inspector into operational tabs: Overview, Metrics, Runs, Alerts, and Setup, with configuration-heavy templates/API setup/alert rules kept under Setup.
- Added a first-class Projects section with project cards, summary counts, latest sample timestamps, project switching, create, rename, and archive actions; the sidebar project dropdown has been replaced by a compact current-project pointer.
- Updated alert handling so Resolve navigates to the alert source node on the Automation Map, while Ignore dismisses the alert through the existing resolution route; workspace alerts now expose safe `nodeId` values.
- Improved Reports and Integrations UI: report creation fields now have visible labels and safety copy, and Integrations now has node selection, grouped telemetry/metric templates, readiness checks, environment blocks, setup checklists, and token/runs shortcuts.
- Added Playwright smoke script for public deployed checks, optional authenticated checks, and optional private-beta mutation checks.
- Added API stubs for project state and REST endpoint test/mapping behavior.
- If database or GitHub OAuth env vars are missing, the app shows a setup-required screen instead of trying to start Auth.js against incomplete config.
- Neon Postgres has been connected locally, initial Prisma migration `20260602131024_init` has been applied, and the demo workspace seed has run successfully on 2026-06-02.
- Local GitHub OAuth configuration is set for `http://localhost:3001`; production deployment uses the Vercel domain and matching GitHub OAuth callback.
- Added completed ArgusGrid project description to `D:\KnowledgeBases\Projects\project_descriptions.md` on 2026-06-06.

## Key Product Decisions
- Team-first account model with owner/admin/member/viewer roles.
- Vercel Hobby + Neon Free prototype target.
- Secured cron routes for cloud-friendly polling.
- Retention plus rollups for historical metric storage.
- Small custom node icons can be stored in Postgres in the prototype.
- Node graph edges are visual relationships only in v1.
- Node status is computed from health rules but supports admin overrides.
- Reports start as secure share links and PNG exports, not full client portals.
- SSE live updates, baseline/anomaly alerting, CSV exports, Slack notifications, and SDK publishing are next-stage priorities.
- Sankey and forecast/correlation views are deferred until usage data proves demand.

## Next Priorities
- Run the smoke script against the deployed Vercel site after each push.
- Browser-test notification preferences, owner/admin test email, alert-rule creation, one-alert/one-email behavior, and alert resolution allowing a later email.
- Browser-test manual "Run poll now" against a demo metric node and confirm the inspector shows the real `95 score` metric card, persisted trend chart, alert update, and no duplicate unresolved email.
- Browser-test workflow telemetry token creation/revocation and a valid `/api/ingest/runs` POST updating the selected node's Runs tab without sending alert email.
- Browser-test Basic/Advanced integration templates: custom REST metric field prefill, telemetry snippets containing the selected node id, and no real token values in copied snippets.
- Browser-test the Deployment readiness dialog and the API tab setup dialogs at desktop height: content should stay within the viewport, scroll internally, and keep the inspector compact.
- Browser-test client report creation, signed-out report access, copy/open/revoke actions, and PNG map export.
- Browser-test the new Control Room IA: section switching, overview attention feed, project-level Runs/Alerts/Reports/Integrations/Team/Settings pages, and the cleaned-up node inspector tabs.
- Browser-test the Projects grid, alert Resolve-to-node and Ignore flows, labelled report creation form, and expanded Integrations setup hub.
- Validate the Prisma report-share migration with `prisma migrate deploy` before production use.
- Test SDK preview snippets against a disposable ingestion token and confirm runs appear in the selected node.
- Browser-test invited-user acceptance, role management, guided API setup, icon upload, alert center filtering, cron polling, deployment diagnostics, and alert resolution on the deployed site.
