# Meridian SDK Preview

Meridian SDKs are the developer adoption loop for the AI automation control room. They send workflow run telemetry to the existing `/api/ingest/runs` endpoint with the same project-scoped ingestion tokens used by webhook templates.

## Python

```python
from meridian import Meridian

def log_telemetry_error(error: Exception) -> None:
    # Keep this secret-safe. Do not include ingestion tokens in logs.
    print(f"Meridian telemetry failed: {error}")


meridian = Meridian(
    token="<ingestion-token>",
    timeout=5,
    on_error=log_telemetry_error,
)

@meridian.trace(node_id="<endpoint-node-id>", name="Support triage agent")
def run_agent(message: str):
    return "handled"

run_agent("Can you check my invoice?")
```

The Python trace decorator sends telemetry synchronously after the wrapped function finishes. Delivery failures are caught inside the decorator, routed to `on_error` when provided, and never change the wrapped function's return value or exception behavior.

## JavaScript

```ts
import { createMeridian } from "@meridian/sdk"

const meridian = createMeridian({
  token: "<ingestion-token>",
  timeoutMs: 5000,
  onError(error) {
    // Keep this secret-safe. Do not include ingestion tokens in logs.
    console.warn("Meridian telemetry failed.", error)
  },
})

await meridian.trace(
  { nodeId: "<endpoint-node-id>", name: "Support triage agent" },
  async () => {
    return "handled"
  }
)

// Use this in CLI scripts, jobs, tests, and serverless handlers before exit.
await meridian.flush()
```

The JavaScript trace helper is non-blocking by default: it returns the wrapped operation result immediately after scheduling telemetry. `flush()` waits for currently pending deliveries to settle, which is useful for demos, short-lived scripts, tests, and serverless handlers.

## Direct Run Ingestion

Use `ingestRun`/`ingest_run` when an automation already has its own run lifecycle and you want to send the exact status yourself:

```ts
await meridian.ingestRun({
  nodeId: "<endpoint-node-id>",
  externalId: "run_001",
  status: "success",
  startedAt: new Date(Date.now() - 1200).toISOString(),
  finishedAt: new Date().toISOString(),
  costUsd: 0.012,
  tokens: 824,
  steps: [
    {
      name: "Classify ticket",
      status: "success",
      latencyMs: 1200,
      toolName: "support-agent",
    },
  ],
})
```

## Runnable Test Examples

Use these scripts with a disposable ingestion token and a selected node id from Meridian. They send one safe synthetic run with status, cost, token, and step details so you can confirm the Runs tab updates.

JavaScript:

```bash
cd sdk/js
npm run build
MERIDIAN_INGESTION_TOKEN="<ingestion-token>" \
MERIDIAN_NODE_ID="<endpoint-node-id>" \
node examples/send-test-run.mjs
```

Python:

```bash
PYTHONPATH=sdk/python \
MERIDIAN_INGESTION_TOKEN="<ingestion-token>" \
MERIDIAN_NODE_ID="<endpoint-node-id>" \
python3 sdk/python/examples/send_test_run.py
```

Optional environment values:

- `MERIDIAN_BASE_URL`: defaults to `https://meridian.hrudainirmal.in`.
- `MERIDIAN_EXTERNAL_ID`: overrides the generated example run id.
- `MERIDIAN_TIMEOUT_MS`: JavaScript delivery timeout in milliseconds.
- `MERIDIAN_TIMEOUT`: Python delivery timeout in seconds.

The scripts print node id and generated external id only; they never print the ingestion token.

## Contract

Both SDKs post provider-neutral workflow run telemetry:

- `nodeId`
- optional `externalId`
- `status`
- `startedAt`
- optional `finishedAt`
- optional `costUsd`
- optional `tokens`
- optional `steps`

SDK-side validation catches missing tokens, invalid base URLs, missing `nodeId`, missing `startedAt`, invalid statuses, and oversized step arrays before attempting network delivery. The server still enforces the authoritative `/api/ingest/runs` contract and verifies that the token belongs to the target node's project.

Telemetry failures are intentionally non-blocking in tracing helpers so monitoring never breaks the customer automation. Use `on_error`/`onError` for secret-safe local observability during setup.

The preview SDKs retain deprecated `ArgusGrid`/`createArgusGrid` aliases for existing callers. New code should import `Meridian` from `meridian` or `createMeridian` from `@meridian/sdk`.

## Local SDK Tests

```bash
cd sdk/js
npm run build
npm test
cd ../..
PYTHONPATH=sdk/python python3 -m unittest discover -s sdk/python/tests
```
