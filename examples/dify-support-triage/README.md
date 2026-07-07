# Dify Support Triage Workflow For Meridian

This example builds a small Dify workflow that drafts a support response and reports the run to Meridian.

The workflow is intentionally small and built in the Dify UI rather than shipped as a DSL import. Dify supports YAML DSL import/export, but the workflow graph schema changes across versions; this recipe is more reliable for a live private-beta test.

References:

- Dify workflow variables include `sys.workflow_run_id` and `sys.timestamp`.
- Dify HTTP Request nodes support variable substitution with `{{variable_name}}`.
- Dify Code nodes define input variables and return a dictionary of declared outputs.

## Meridian Setup

1. Open Meridian.
2. Create or select a disposable project and node.
3. Open `Integrations`.
4. Select `Dify Workflow`.
5. Create a disposable ingestion token.
6. Copy the node id and token.

## Dify Workflow Shape

Create a new Dify Workflow app named `Meridian Support Triage Demo`.

### 1. User Input Node

Add these input variables:

| Variable | Type | Example |
| --- | --- | --- |
| `customer_message` | Paragraph | `My invoice is wrong and I need help today.` |
| `meridian_node_id` | Text | Meridian endpoint node id |
| `meridian_ingestion_token` | Secret/Text | Meridian disposable ingestion token |
| `demo_mode` | Text | `success`, `degraded`, or `failed` |

Use `success` when you want the simplest happy path.

### 2. LLM Node

Name: `Draft support response`

Prompt:

```text
You are a concise support triage agent.

Classify the customer message, summarize the issue, and draft a helpful next response.

Customer message:
{{customer_message}}

Return:
- intent
- urgency
- summary
- draft_response
```

### 3. Code Node

Name: `Build Meridian payload`

Input variables:

| Code input | Source |
| --- | --- |
| `node_id` | `meridian_node_id` |
| `workflow_run_id` | `sys.workflow_run_id` |
| `workflow_started_at` | `sys.timestamp` |
| `demo_mode` | `demo_mode` |

Code:

```python
def main(node_id: str, workflow_run_id: str, workflow_started_at: int, demo_mode: str = "success") -> dict:
    import datetime

    mode = demo_mode if demo_mode in ["success", "degraded", "failed"] else "success"
    status = "success"
    context_status = "success"
    draft_status = "success"

    if mode == "degraded":
        status = "degraded"
        context_status = "degraded"
    elif mode == "failed":
        status = "failed"
        draft_status = "failed"

    started = datetime.datetime.fromtimestamp(int(workflow_started_at), datetime.UTC)
    finished = datetime.datetime.now(datetime.UTC)

    return {
        "node_id": node_id,
        "external_id": f"dify-support-triage-{workflow_run_id}",
        "status": status,
        "started_at": started.isoformat().replace("+00:00", "Z"),
        "finished_at": finished.isoformat().replace("+00:00", "Z"),
        "cost_usd": "0.018",
        "tokens": "840",
        "context_status": context_status,
        "draft_status": draft_status,
    }
```

Declared outputs:

- `node_id`
- `external_id`
- `status`
- `started_at`
- `finished_at`
- `cost_usd`
- `tokens`
- `context_status`
- `draft_status`

### 4. HTTP Request Node

Name: `Report run to Meridian`

Method: `POST`

URL:

```text
https://meridian.hrudainirmal.in/api/ingest/runs
```

Headers:

```text
Authorization: Bearer {{meridian_ingestion_token}}
Content-Type: application/json
```

Body type: JSON

Paste the body from [`meridian-http-body.json`](./meridian-http-body.json).

### 5. Output Node

Return the LLM draft response and the Meridian run id. Use Dify's variable picker to select `external_id` from the `Build Meridian payload` Code node output:

```text
Support response drafted.

Meridian external id:
{{external_id from Build Meridian payload}}
```

## Verify In Meridian

1. Run the Dify workflow once with `demo_mode=success`.
2. Open Meridian -> selected node -> `Runs`.
3. Confirm the run appears with:
   - source node id
   - external id beginning `dify-support-triage-`
   - five step rows
   - cost and token values
4. Run again with `demo_mode=degraded`.
5. Run again with `demo_mode=failed`.
6. Confirm Logs and live refresh show the new runs.

The workflow should never print the ingestion token in Dify output. Revoke the disposable token after testing.
