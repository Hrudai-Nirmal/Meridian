# Changelog

## Unreleased

- Renamed the product, canonical domain, application surfaces, notifications, integrations, SDK previews, and operational tooling from ArgusGrid to Meridian.
- Added compatibility aliases for existing ingestion clients, signed webhook consumers, SDK callers, cron authentication, CSV metadata, and build metadata.
- Added Postgres-backed durable notification jobs with Inngest retries/recovery, queue diagnostics, job-status Logs filters, and owner/admin retry/cancel controls.
- Added SDK package publish-readiness checks, package-level READMEs, npm/Python metadata, JavaScript pack dry-run verification, and Python wheel verification.
- Published the JavaScript SDK as `@meridian-workflows/sdk` and added in-app node-specific SDK onboarding snippets in Integrations.
- Added a reusable live workflow demo that sends success, degraded, and failed Support Triage Agent runs through the published JavaScript SDK.

## 0.1.0

- Private-beta Meridian control room with project maps, telemetry ingestion, metric polling, alerts, reports, Logs, Testing, generic webhooks, Slack destinations, SDK previews, and production smoke checks.
- Enterprise foundation begins with CI, manual production smoke workflow, safe build metadata, and release discipline.
