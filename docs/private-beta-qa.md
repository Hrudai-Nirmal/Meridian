# Private-Beta QA Checklist

Use this checklist for production validation on `https://meridian.hrudainirmal.in`. Create only disposable test projects, test reports, test webhooks, and test Slack destinations.

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
- `/api/health` includes runtime metadata for Production/Preview/Local, deployment URL, side-effect policy, background-job policy, cron policy, and safe warnings.
- A database outage disables GitHub sign-in, shows a safe incident ID, and emits a matching structured runtime log without connection strings or credentials.

## Projects

- Create a disposable project.
- Rename the project and confirm the new name persists after refresh.
- Switch between projects from the Projects section.
- Archive only the disposable project and confirm it leaves the active list.

## Global Search

- Click the header search and confirm the command palette opens.
- Press `Cmd/Ctrl+K` and confirm it opens from any main dashboard section.
- Press `/` outside an input field and confirm it opens without typing into the page.
- Search for a node name, alert title, run external id, report title, integration provider, and notification job status.
- Confirm selecting results navigates to the right section, selects the node/alert where applicable, and can open Logs filtered to failed jobs.
- Confirm result rows never show raw ingestion tokens, webhook URLs, Slack URLs, signing secrets, encrypted payloads, env values, or private credential bodies.

## Interactive Tutorial

- Clear `meridian-tutorial:first-workflow:v1` from localStorage and open a no-telemetry disposable project; confirm the tutorial auto-starts.
- Confirm the page is not dimmed and the underlying app remains clickable while the tutorial is active.
- Confirm the widget starts bottom-center, can be dragged to snap to an edge/corner, and can hide/show through the compact `Show tutorial ^` tab.
- Confirm `Open the automation map` and `Open integration templates` mark complete after those steps are visited.
- Confirm tutorial steps highlight actual REST metric setup components across Automation Map, Integrations, Testing, and Reports.
- Confirm the evidence progress bar starts from the tutorial-start baseline, ignores sample fallback rows, and advances after a node exists, a real metric sample arrives, and a report link is created.
- Click `Check progress` and confirm it refreshes evidence without exposing secrets.
- Confirm `Back`, `Next`, `Skip`, and `Finish` work.
- Confirm Skip/Finish prevents auto-start after refresh.
- Click `Start tutorial` in Control Room and confirm the tutorial restarts from the evidence-appropriate step.
- Confirm missing targets show fallback copy instead of breaking the dashboard.
- Confirm tutorial copy never exposes raw tokens, webhook URLs, Slack URLs, signing secrets, encrypted payloads, env values, or credential bodies.

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
- In Integrations, confirm telemetry templates show the `npm install @meridian-workflows/sdk` onboarding block with the selected node id and no real token value.
- Run the JavaScript or Python SDK example script from `docs/sdk.md` against a disposable token.
- Run `examples/live-workflow` in success, degraded, and failed modes against a disposable token.
- Build the Dify workflow from `examples/dify-support-triage`, run it in success, degraded, and failed modes, and confirm each run appears in Meridian.
- Confirm the example output does not print the ingestion token.
- Run `npm run sdk:verify` locally or in CI before handing SDK instructions to a beta user.
- Confirm Runs updates with status, timestamps, cost/tokens when supplied, and step details.
- Confirm the selected node's summary cards switch from seeded defaults to run-derived success rate, average latency, daily cost, and eval score after telemetry arrives.
- Confirm live indicator updates or manual refresh brings the new run into view.
- Background the dashboard tab, return to it, and confirm the live indicator reconnects without a page reload.

## Polling, Metrics, And Alerts

- Configure a node with the demo metric shortcut.
- Set a cadence above one minute and confirm scheduled polls do not create a sample on every scheduler tick.
- Run manual poll from Testing.
- Confirm the selected node shows the deterministic `95 score` sample and trend/freshness details.
- Confirm a matching threshold alert opens once and does not duplicate while unresolved.
- Set Repeat suppression to `1`, trigger the same breach twice inside a minute, and confirm the existing incident shows a higher occurrence count and newer last-seen time instead of a duplicate row.
- Trigger the same breach after the suppression window and confirm Meridian still keeps one grouped incident while allowing a repeat notification/job.
- In the selected node Alert Rule dialog, apply a metric threshold template and confirm the mapping, threshold, severity, and enabled state are prefilled.
- Apply metric anomaly templates for high, low, and both directions; confirm sample-history preview still shows baseline/wait-state details.
- Apply a workflow-run template such as failed/degraded run, run duration, cost, tokens, failure rate, or average latency.
- Send matching Dify/SDK/API run telemetry and confirm run-source rules open alerts after ingestion.
- Confirm metric polling does not evaluate run-source rules, and workflow-run ingestion does not evaluate metric-source rules.
- Resolve/ignore the alert and confirm alert detail, node status, Logs, and notifications update.
- Confirm anomaly alert preview explains sample count, baseline, standard deviation, and wait state when history is insufficient.

## Reports

- Open Reports and fill title, client name, subtitle, prepared by, executive note, and expiry.
- Save the current report defaults as a preset, reload presets, apply it, and delete it.
- Create reports with 7d, 30d, 90d, all-data, and custom start/end periods.
- Confirm previous-period comparison can be enabled for bounded periods and is disabled for all-data reports.
- Upload a small PNG/SVG brand image and confirm the in-app preview shows it in the report header.
- Try an oversized or unsafe SVG brand image and confirm it is rejected without creating a link.
- Attach the current map and confirm the in-app preview includes the map and summary metrics.
- Create a report link and open it in a signed-out/private browser.
- Confirm the public report header shows the uploaded brand image when present.
- Confirm the public report shows the period label, comparison notes when enabled, and an active/resolved incident timeline.
- Confirm repeated incidents show occurrence count and last-seen evidence in public report incident timelines.
- Confirm comparison badges clearly show direction and tone for runs, success rate, score, spend, and tokens.
- Click `Copy client summary` and confirm the copied text is readable, client-safe, and contains no secrets.
- Filter the public incident timeline by All, Active only, and Resolved only.
- Confirm the public report is read-only and does not expose secrets, tokens, credentials, or private team data.
- Use Print / Save PDF and confirm print layout is clean.
- Revoke the report link and confirm the public page, brand image, and map image no longer open.
- Download CSV exports for runs, metrics, and alerts as an owner/admin; confirm they are bounded, open cleanly, and contain no secrets.

## Integrations

- In Integrations, create a disposable telemetry token from the selected provider setup.
- Confirm setup snippets include placeholders or the one-time token only where expected.
- Confirm Dify, n8n, GitHub Actions, and JavaScript SDK templates show provider-specific step badges, setup copy, status badges, and a provider first-signal card that reaches the real-run-received state without exposing the token.
- In the Dify wizard, confirm Code-node and HTTP Request-node guidance includes the selected node id, uses `<ingestion-token>` placeholders, and never exposes a real token unless one was just created for one-time copy.
- Create a generic webhook destination with a temporary HTTPS receiver.
- Confirm the signing secret is shown once and never returned after refresh.
- Test the webhook and confirm receiver headers and payload are safe.
- Create a Slack destination with a disposable Slack incoming webhook URL.
- Confirm the Slack destination list never shows the URL.
- Test Slack from Integrations and confirm Slack receives the Block Kit message.
- Disable webhook/Slack destinations and confirm disabled destinations do not receive events.

## Testing

- Confirm readiness cards show database connectivity, database schema, auth, encryption, cron, email, Inngest jobs, and poll status.
- Confirm runtime safety shows Production on `https://meridian.hrudainirmal.in` with external side effects, background jobs, and cron enabled.
- Confirm any Preview/local runtime clearly shows non-production status and does not send email, Slack, webhooks, or endpoint polling unless explicitly opted in.
- Queue email, webhook, and Slack tests; confirm the UI follows each job from queued to a terminal result.
- In `Notification jobs`, verify counts, refresh, failed-job retry, queued/retrying cancellation, and owner/admin enforcement.
- Use a failing disposable webhook and confirm retry progress before the job becomes failed.
- Confirm Deployment readiness shows safe version, commit, build time, environment metadata, and `Database schema current`.
- Run manual poll and confirm latest poll metadata updates.
- For REST metric onboarding, save API setup on a selected node, use the node inspector's `REST metric first signal` card to run the first poll, and confirm `Real sample received` shows a real persisted metric value and timestamp.
- Send test email and confirm success/failure feedback does not expose provider secrets.
- Send generic webhook and Slack tests from Testing.
- Run integration readiness/test-run shortcuts for the selected node.
- Confirm endpoint/API setup shortcuts route back to the selected node workflow.
- In API setup, confirm selecting an auth type reveals required auth header and secret fields, custom headers send the secret in the named header, and the right-side help panel updates as each field is focused.

## Logs

- Filter Logs by 24h, 7d, 30d, and All.
- Filter by Activity, Alerts, Polling, Deliveries, Runs, Reports, Webhooks, Team, and Map.
- Filter notification jobs by queued, running, retrying, sent, failed, skipped, and cancelled status.
- Search for a known report, webhook, Slack destination, token, or alert action.
- Confirm log rows show timestamp, type, title/action, entity, status, context, and safe metadata.
- Confirm Logs shows returned/limit/truncation metadata for the current filter.
- Confirm Logs never expose raw tokens, webhook secrets, Slack URLs, encrypted payloads, env values, or private credential bodies.
- Confirm notification job rows expose attempts and safe summaries, never provider URLs, keys, or message payloads.

## Team Access

- Confirm Team shows `Project Access Review` and `Role Capability Matrix`.
- Confirm viewer copy says viewers can inspect safe dashboards/logs/reports but cannot mutate configuration or export data.
- Invite a disposable email as Viewer, then invite it again and confirm Meridian reports the existing pending invite instead of creating a duplicate row.
- Cancel the pending invite and confirm Logs shows safe team audit evidence.
- Confirm owner/admin users can change non-owner roles and remove non-owner members.
- Confirm members/viewers cannot create generic webhook destinations, Slack destinations, telemetry tokens, report links, report presets, CSV exports, project edits, or team invites.
- Confirm members can still edit map/nodes/API metric setup and alert rules where the matrix says allowed.

## Settings

- Confirm Settings is configuration-only.
- Save notification preferences and confirm a visible success result.
- Confirm telemetry/environment configuration remains secret-safe.
- Confirm diagnostic actions live in Testing, not Settings.

## Final Pass

- Test desktop at 1440px wide and a smaller laptop/tablet width.
- Toggle light/dark mode and confirm readable text, borders, controls, graph dots, and report surfaces.
- Run `SMOKE_BASE_URL="https://meridian.hrudainirmal.in" npm run test:smoke`.
- After Vercel deploys `main`, run `npm run prisma:deploy`, then `npm run release:check`, then manually dispatch the GitHub Actions `Production smoke` workflow.
- Record failures as separate fix tasks with reproduction steps and screenshots when useful.
