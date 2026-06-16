# Private-Beta QA Checklist

Use this checklist for production validation on `https://argusgrid.hrudainirmal.in`. Create only disposable test projects, test reports, test webhooks, and test Slack destinations.

## Setup

- Use an owner/admin account for full coverage.
- Keep a signed-out/private browser window ready for report-link checks.
- Prepare a temporary generic webhook receiver, such as webhook.site.
- Prepare a disposable Slack incoming webhook URL for Slack checks.
- Use a safe test recipient for email checks.

## Sign-In And Onboarding

- Fresh signed-out browser lands on GitHub sign-in.
- New-user onboarding can create a blank project.
- New-user onboarding can create the demo project.
- Returning users land in the dashboard without repeated onboarding.
- `/api/health` returns safe readiness JSON without raw secret values.
- `/api/health` includes safe version, commit, build time, and environment metadata.

## Projects

- Create a disposable project.
- Rename the project and confirm the new name persists after refresh.
- Switch between projects from the Projects section.
- Archive only the disposable project and confirm it leaves the active list.

## Automation Map

- Open Automation Map and confirm there is no React Flow attribution watermark.
- Confirm minimap, zoom controls, dot grid, status badges, and node inspector remain visible.
- In view mode, verify node handles are visible but cannot create new links.
- Enable Edit mode, drag a node, wait for autosave, refresh, and confirm position persists.
- Drag an output handle to another node's input handle and confirm a visual link appears.
- Click a link, edit the label, wait for autosave, refresh, and confirm the label persists.
- Try a self-link and an exact duplicate link; confirm neither is created.
- Export PNG and confirm the downloaded/current map image is readable.
- Upload a small PNG/SVG custom icon to a disposable node and confirm validation feedback.

## Runs And Telemetry

- Create or reuse a disposable ingestion token.
- Confirm the raw token is shown once and later lists only safe prefix metadata.
- Revoke a disposable token and confirm future ingestion with it is rejected.
- Post a valid `/api/ingest/runs` payload for a selected node.
- Confirm Runs updates with status, timestamps, cost/tokens when supplied, and step details.
- Confirm live indicator updates or manual refresh brings the new run into view.

## Polling, Metrics, And Alerts

- Configure a node with the demo metric shortcut.
- Run manual poll from Testing.
- Confirm the selected node shows the deterministic `95 score` sample and trend/freshness details.
- Confirm a matching threshold alert opens once and does not duplicate while unresolved.
- Resolve/ignore the alert and confirm alert detail, node status, Logs, and notifications update.
- Confirm anomaly alert preview explains sample count, baseline, standard deviation, and wait state when history is insufficient.

## Reports

- Open Reports and fill title, client name, subtitle, prepared by, executive note, and expiry.
- Attach the current map and confirm the in-app preview includes the map and summary metrics.
- Create a report link and open it in a signed-out/private browser.
- Confirm the public report is read-only and does not expose secrets, tokens, credentials, or private team data.
- Use Print / Save PDF and confirm print layout is clean.
- Revoke the report link and confirm the public page and map image no longer open.
- Download CSV exports for runs, metrics, and alerts as an owner/admin.

## Integrations

- In Integrations, create a disposable telemetry token from the selected provider setup.
- Confirm setup snippets include placeholders or the one-time token only where expected.
- Create a generic webhook destination with a temporary HTTPS receiver.
- Confirm the signing secret is shown once and never returned after refresh.
- Test the webhook and confirm receiver headers and payload are safe.
- Create a Slack destination with a disposable Slack incoming webhook URL.
- Confirm the Slack destination list never shows the URL.
- Test Slack from Integrations and confirm Slack receives the Block Kit message.
- Disable webhook/Slack destinations and confirm disabled destinations do not receive events.

## Testing

- Confirm readiness cards show database, auth, encryption, cron, email, and poll status.
- Confirm Deployment readiness shows safe version, commit, build time, and environment metadata.
- Run manual poll and confirm latest poll metadata updates.
- Send test email and confirm success/failure feedback does not expose provider secrets.
- Send generic webhook and Slack tests from Testing.
- Run integration readiness/test-run shortcuts for the selected node.
- Confirm endpoint/API setup shortcuts route back to the selected node workflow.

## Logs

- Filter Logs by 24h, 7d, 30d, and All.
- Filter by Activity, Alerts, Polling, Deliveries, Runs, Reports, Webhooks, Team, and Map.
- Search for a known report, webhook, Slack destination, token, or alert action.
- Confirm log rows show timestamp, type, title/action, entity, status, context, and safe metadata.
- Confirm Logs never expose raw tokens, webhook secrets, Slack URLs, encrypted payloads, env values, or private credential bodies.

## Settings

- Confirm Settings is configuration-only.
- Save notification preferences and confirm a visible success result.
- Confirm telemetry/environment configuration remains secret-safe.
- Confirm diagnostic actions live in Testing, not Settings.

## Final Pass

- Test desktop at 1440px wide and a smaller laptop/tablet width.
- Toggle light/dark mode and confirm readable text, borders, controls, graph dots, and report surfaces.
- Run `SMOKE_BASE_URL="https://argusgrid.hrudainirmal.in" npm run test:smoke`.
- After Vercel deploys `main`, manually dispatch the GitHub Actions `Production smoke` workflow.
- Record failures as separate fix tasks with reproduction steps and screenshots when useful.
