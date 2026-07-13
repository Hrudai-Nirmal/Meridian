const TELEMETRY_PROVIDER_LABELS = {
  dify: "Dify",
  n8n: "n8n",
  "github-actions": "GitHub Actions",
}

function step(id, title, body, status) {
  return { id, title, body, status }
}

function firstCurrent(steps) {
  const firstWaitingIndex = steps.findIndex((candidate) => candidate.status === "waiting")
  if (firstWaitingIndex === -1) return steps
  return steps.map((candidate, index) => (index === firstWaitingIndex ? { ...candidate, status: "current" } : candidate))
}

/**
 * Builds evidence-backed wizard steps for the selected provider.
 *
 * @param {{
 *   setupKind: "metric" | "telemetry",
 *   providerId: string,
 *   hasSelectedNode: boolean,
 *   hasCreatedToken: boolean,
 *   hasRecentRun: boolean,
 *   hasMetricSetup: boolean,
 *   hasMetricSample?: boolean,
 * }} input
 */
export function buildIntegrationWizardSteps(input) {
  if (input.setupKind === "metric") {
    const hasMetricSample = Boolean(input.hasMetricSample)
    return firstCurrent([
      step("select-node", "Select node", "Choose the node Meridian should poll for metric samples.", input.hasSelectedNode ? "done" : "waiting"),
      step("configure-api", "Configure API", "Open API setup, enter the endpoint URL, auth fields, JSONPath, transform, and threshold.", input.hasMetricSetup ? "done" : "waiting"),
      step("test-endpoint", "Test endpoint", "Preview response JSON, mapped value, transform result, and threshold behavior.", input.hasMetricSetup ? "done" : "waiting"),
      step("verify-sample", "Verify sample", "Run polling and confirm the node shows a latest metric sample.", hasMetricSample ? "done" : "waiting"),
    ])
  }

  const providerName = TELEMETRY_PROVIDER_LABELS[input.providerId] ?? "provider"
  return firstCurrent([
    step("select-node", "Select node", "Choose the graph node that represents this workflow.", input.hasSelectedNode ? "done" : "waiting"),
    step("create-token", "Create token", "Create a one-time Meridian ingestion token and copy it immediately.", input.hasCreatedToken ? "done" : "waiting"),
    step("configure-provider", `Configure ${providerName}`, "Paste the provider-specific code, HTTP request settings, and placeholders into the workflow.", input.hasRecentRun ? "done" : "waiting"),
    step("send-test", "Run once", "Run the external workflow once, or use Meridian's built-in synthetic test run.", input.hasRecentRun ? "done" : "waiting"),
    step("verify-run", "Verify in Meridian", "Confirm Runs, Logs, and node summary cards update from the submitted telemetry.", input.hasRecentRun ? "done" : "waiting"),
  ])
}

/**
 * Builds provider-specific setup copy for the wizard panel.
 *
 * @param {{ providerId: string, nodeId: string }} input
 */
export function buildProviderSetupCopy(input) {
  if (input.providerId === "dify") {
    return {
      codeNode: `def main(node_id: str, workflow_run_id: str, usage: object = None) -> dict:
    import datetime
    import uuid

    run_id = workflow_run_id or str(uuid.uuid4())
    finished = datetime.datetime.now(datetime.UTC)
    started = finished - datetime.timedelta(milliseconds=3200)

    tokens = 0
    if isinstance(usage, dict):
        tokens = usage.get("total_tokens") or usage.get("totalTokens") or usage.get("tokens") or 0
    elif isinstance(usage, (int, float, str)):
        tokens = usage or 0
    try:
        tokens = int(float(tokens))
    except Exception:
        tokens = 0

    return {
        "result": {
            "nodeId": node_id,
            "externalId": f"dify-{run_id}",
            "status": "success",
            "startedAt": started.isoformat().replace("+00:00", "Z"),
            "finishedAt": finished.isoformat().replace("+00:00", "Z"),
            "costUsd": round(tokens * 0.000002, 6),
            "tokens": tokens,
            "steps": [
                {"name": "User input", "status": "success", "latencyMs": 120, "toolName": "dify-user-input"},
                {"name": "Knowledge retrieval", "status": "success", "latencyMs": 900, "toolName": "dify-knowledge-retrieval"},
                {"name": "LLM response", "status": "success", "latencyMs": 2100, "toolName": "dify-llm"},
                {"name": "Answer", "status": "success", "latencyMs": 80, "toolName": "dify-answer"},
            ],
        }
    }`,
      httpRequest: `POST https://meridian.hrudainirmal.in/api/ingest/runs
Headers:
Authorization: Bearer <ingestion-token>
Content-Type: application/json

Body:
Code.result

Code input variables:
node_id = hidden/prefilled Meridian node id (${input.nodeId || "<node-id>"})
workflow_run_id = sys.workflow_run_id
usage = LLM usage/metadata if Dify exposes it`,
    }
  }

  if (input.providerId === "n8n") {
    return {
      codeNode: "Add an HTTP Request node after your workflow completes.",
      httpRequest: `POST https://meridian.hrudainirmal.in/api/ingest/runs
Authorization: Bearer <ingestion-token>
Content-Type: application/json

Use the selected node id: ${input.nodeId || "<node-id>"}`,
    }
  }

  if (input.providerId === "github-actions") {
    return {
      codeNode: "Store the ingestion token as a GitHub Actions secret named MERIDIAN_INGESTION_TOKEN.",
      httpRequest: `Report with curl from a final if: always() step.
Use node id: ${input.nodeId || "<node-id>"}`,
    }
  }

  return {
    codeNode: "Open API setup on the selected node and configure the endpoint, auth, JSONPath, transform, and threshold.",
    httpRequest: "Metric polling does not use ingestion tokens. Meridian polls the endpoint on the saved cadence.",
  }
}
