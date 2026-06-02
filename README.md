# ArgusGrid

ArgusGrid is a PC-first Next.js dashboard for monitoring AI workflow automations. Projects open to a graph-first endpoint map; selecting a node shows health, API metadata, alerts, recent runs, costs, and quality signals.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui
- Auth.js with GitHub OAuth and Prisma adapter
- Prisma + Neon Postgres
- React Flow for project maps
- Apache ECharts for dashboard visualizations

## Environment

Create `.env.local` from `.env.example`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/argusgrid?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
GITHUB_ID="replace-with-github-oauth-client-id"
GITHUB_SECRET="replace-with-github-oauth-client-secret"
CRON_SECRET="replace-with-a-long-random-cron-secret"
```

For GitHub OAuth local development, set the callback URL to:

```text
http://localhost:3000/api/auth/callback/github
```

## Development

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Bootstrap

On first GitHub login, ArgusGrid creates:

- one personal organization;
- an owner membership for the signed-in user;
- the seeded “Support Automation Grid” project;
- default monitoring categories, endpoint nodes, visual graph edges, endpoint metadata, and node overrides.

The seed command creates a separate local demo workspace and is idempotent.

## Current Scope

This milestone includes real auth, organization/project persistence, DB-backed graph loading, autosaved node/edge graph state, node basics, status overrides, and endpoint metadata. Real polling, encrypted project secrets, metric samples, rollups, alert delivery, and custom icon uploads are still intentionally deferred.
