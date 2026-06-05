# ArgusGrid

ArgusGrid is a deployed-first Next.js dashboard for monitoring AI workflow automations. Projects open to a graph-first endpoint map; selecting a node shows health, API metadata, alerts, recent runs, costs, and quality signals.

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

Vercel cron is configured in `vercel.json` to call `/api/cron/poll` daily for Hobby-compatible limits. The route requires `CRON_SECRET`.

The deployed app exposes `/api/health` for safe readiness checks. It returns booleans and poll metadata only; it must never return secret values.

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
- Team invitation save shows a visible result.
- API setup stores configuration without exposing secret values.
- `/api/cron/poll` rejects a wrong bearer token.
- Deployment diagnostics show database, auth, encryption, cron, and latest poll status.
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

The app now includes project management, team invitations, encrypted API credential storage, metric mappings, cron polling, metric samples, hourly rollups, poll execution logs, readiness diagnostics, raw sample retention cleanup, and in-app alerts. Email delivery and custom icon uploads are still deferred.
