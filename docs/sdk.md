# ArgusGrid SDK Preview

ArgusGrid SDKs are the developer adoption loop for the AI automation control room. They send workflow run telemetry to the existing `/api/ingest/runs` endpoint with the same project-scoped ingestion tokens used by webhook templates.

## Python

```python
from argusgrid import ArgusGrid

argus = ArgusGrid(token="<ingestion-token>")

@argus.trace(node_id="<endpoint-node-id>", name="Support triage agent")
def run_agent(message: str):
    return "handled"

run_agent("Can you check my invoice?")
```

## JavaScript

```ts
import { createArgusGrid } from "@argusgrid/sdk"

const argus = createArgusGrid({ token: "<ingestion-token>" })

await argus.trace(
  { nodeId: "<endpoint-node-id>", name: "Support triage agent" },
  async () => {
    return "handled"
  }
)
```

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

Telemetry failures are intentionally non-blocking in tracing helpers so monitoring never breaks the customer automation.
