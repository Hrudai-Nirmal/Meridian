# ArgusGrid Context

## Project Purpose
ArgusGrid is a PC-first Next.js dashboard for monitoring AI workflow automations. The product is graph-first: each project opens to a visual endpoint map where nodes represent user-labelled services, APIs, tools, or automation endpoints. Selecting a node opens a dashboard inspector for health, runs, cost, latency, quality, alerts, and API parameter mappings.

## Current Implementation State
- Scaffolded with Next.js App Router, TypeScript, Tailwind CSS v4, and shadcn/ui base components.
- Added React Flow for the endpoint graph and Apache ECharts for analytics visuals.
- Added Prisma schema for the planned Neon Postgres backend. The runnable UI currently uses seeded in-app data while the database is wired later.
- Added secured cron route scaffolding for polling and alert evaluation.
- Added API stubs for project state and REST endpoint test/mapping behavior.
- Verified build, lint, Prisma schema validation, desktop browser flow, and mobile no-overflow fallback on 2026-05-31.

## Key Product Decisions
- Team-first account model with owner/admin/member/viewer roles.
- Vercel Hobby + Neon Free prototype target.
- Secured cron routes for cloud-friendly polling.
- Retention plus rollups for historical metric storage.
- Small custom node icons can be stored in Postgres in the prototype.
- Node graph edges are visual relationships only in v1.
- Node status is computed from health rules but supports admin overrides.

## Next Priorities
- Connect Auth.js sessions and role checks to real organization/project data.
- Run Prisma generation/migrations in a database-ready environment.
- Replace seeded data with database-backed graph persistence and metric samples.
- Add encrypted project secret storage and real REST polling execution.
- Add email provider configuration for alert delivery.
