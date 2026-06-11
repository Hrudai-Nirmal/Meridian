# ArgusGrid Context

## Project Purpose
ArgusGrid is a PC-first Next.js dashboard for monitoring AI workflow automations. The product is graph-first: each project opens to a visual endpoint map where nodes represent user-labelled services, APIs, tools, or automation endpoints. Selecting a node opens a dashboard inspector for health, runs, cost, latency, quality, alerts, and API parameter mappings.

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
- Added visual polish for the deployed dashboard: neutral black/grey dark mode tokens, clearer React Flow dot grid visibility, and edit-mode node snapping to the nearest 22px grid point on drag release.
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

## Next Priorities
- Run the smoke script against the deployed Vercel site after each push.
- Browser-test notification preferences, owner/admin test email, alert-rule creation, one-alert/one-email behavior, and alert resolution allowing a later email.
- Browser-test manual "Run poll now" against a demo metric node and confirm the inspector shows the real `95 score` metric card, persisted trend chart, alert update, and no duplicate unresolved email.
- Browser-test invited-user acceptance, role management, guided API setup, icon upload, alert center filtering, cron polling, deployment diagnostics, and alert resolution on the deployed site.
