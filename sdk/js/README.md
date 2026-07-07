# Meridian JavaScript SDK

JavaScript tracing SDK for Meridian workflow telemetry. It sends provider-neutral run data to `/api/ingest/runs` with a project-scoped ingestion token.

## Install

Private beta currently keeps the package in this repository:

```bash
cd sdk/js
npm run build
```

Future public install path:

```bash
npm install @meridian-workflows/sdk
```

## Quick Start

```ts
import { createMeridian } from "@meridian-workflows/sdk"

const meridian = createMeridian({
  token: process.env.MERIDIAN_INGESTION_TOKEN!,
  timeoutMs: 5000,
  onError(error) {
    console.warn("Meridian telemetry failed.", error)
  },
})

await meridian.trace(
  { nodeId: process.env.MERIDIAN_NODE_ID!, name: "Support agent" },
  async () => {
    return await runAutomation()
  },
)

await meridian.flush()
```

Use `flush()` in jobs, tests, CLI scripts, and serverless handlers before the process exits.

## Send A Test Run

```bash
MERIDIAN_INGESTION_TOKEN="<ingestion-token>" \
MERIDIAN_NODE_ID="<endpoint-node-id>" \
node examples/send-test-run.mjs
```

Optional env values:

- `MERIDIAN_BASE_URL`: defaults to `https://meridian.hrudainirmal.in`.
- `MERIDIAN_EXTERNAL_ID`: overrides the generated example run id.
- `MERIDIAN_TIMEOUT_MS`: delivery timeout in milliseconds.

The example prints node id and external id only. It never prints the ingestion token.

## Verify Package Readiness

```bash
npm install --package-lock=false
npm run packcheck
```

`packcheck` builds, tests, and runs `npm pack --dry-run --json`.

## Compatibility

Deprecated `createArgusGrid` and `ArgusGrid*` type aliases remain for existing preview callers. New code should use `createMeridian` and `Meridian*` names.
