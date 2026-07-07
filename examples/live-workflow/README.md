# Meridian Live Workflow Demo

This demo simulates a support triage automation and sends one real workflow run to Meridian through the published `@meridian-workflows/sdk` package.

## Meridian Setup

1. Open [Meridian](https://meridian.hrudainirmal.in).
2. Create or select a disposable project and node.
3. Open `Integrations`.
4. Select a workflow telemetry template.
5. Create a disposable telemetry token.
6. Copy the token and selected node id.

## Local Setup

```bash
cd examples/live-workflow
npm install
```

Run a successful workflow:

```bash
MERIDIAN_INGESTION_TOKEN="<ingestion-token>" \
MERIDIAN_NODE_ID="<endpoint-node-id>" \
npm start
```

Run degraded and failed variants:

```bash
MERIDIAN_INGESTION_TOKEN="<ingestion-token>" \
MERIDIAN_NODE_ID="<endpoint-node-id>" \
MERIDIAN_DEMO_MODE=degraded \
npm start
```

```bash
MERIDIAN_INGESTION_TOKEN="<ingestion-token>" \
MERIDIAN_NODE_ID="<endpoint-node-id>" \
MERIDIAN_DEMO_MODE=failed \
npm start
```

Optional environment values:

- `MERIDIAN_BASE_URL`: defaults to `https://meridian.hrudainirmal.in`.
- `MERIDIAN_DEMO_MODE`: `success`, `degraded`, or `failed`.

## Verify In Meridian

- Open the selected node's `Runs` tab.
- Confirm the latest run appears with status, timestamps, cost, tokens, and five step rows.
- Confirm the live indicator refreshes automatically, or use manual refresh.
- Open `Logs` and search for the generated external id.
- Revoke the disposable token and confirm future demo runs are rejected.

The script prints node id, status, external id, and step count only. It never prints the ingestion token.
