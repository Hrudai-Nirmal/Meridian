import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

test("Dify Meridian HTTP body is valid JSON with expected placeholders", async () => {
  const bodyText = await readFile("examples/dify-support-triage/meridian-http-body.json", "utf8")
  const body = JSON.parse(bodyText)

  assert.equal(body.nodeId, "{{node_id}}")
  assert.equal(body.externalId, "{{external_id}}")
  assert.equal(body.status, "{{status}}")
  assert.equal(body.steps.length, 5)
  assert.equal(body.steps[2].status, "{{context_status}}")
  assert.equal(body.steps[3].status, "{{draft_status}}")
})

test("Dify workflow guide stays secret-safe and points to Meridian", async () => {
  const readme = await readFile("examples/dify-support-triage/README.md", "utf8")
  const bodyText = await readFile("examples/dify-support-triage/meridian-http-body.json", "utf8")
  const combined = `${readme}\n${bodyText}`

  assert.match(combined, /https:\/\/meridian\.hrudainirmal\.in\/api\/ingest\/runs/)
  assert.match(combined, /Authorization: Bearer \{\{meridian_ingestion_token\}\}/)
  assert.match(combined, /sys\.workflow_run_id/)
  assert.match(combined, /sys\.timestamp/)
  assert.equal(combined.includes("194deb44"), false)
  assert.equal(combined.includes("npg_"), false)
  assert.equal(combined.includes("secret_token_value"), false)
})
