import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { buildIntegrationWizardSteps, buildProviderSetupCopy } from "../src/lib/integration-wizard.mjs"

test("integrationTemplates expose core telemetry providers including JavaScript SDK", () => {
  const source = readFileSync(new URL("../src/lib/integration-templates.ts", import.meta.url), "utf8")
  const templateArraySource = source.slice(source.indexOf("export const integrationTemplates"))
  const telemetryIds = Array.from(templateArraySource.matchAll(/id: "(dify|n8n|github-actions|javascript-sdk)"/g)).map((match) => match[1])

  assert.deepEqual(telemetryIds, ["dify", "n8n", "github-actions", "javascript-sdk"])
})

test("buildIntegrationWizardSteps marks telemetry wizard progress from evidence", () => {
  const steps = buildIntegrationWizardSteps({
    setupKind: "telemetry",
    providerId: "dify",
    hasSelectedNode: true,
    hasCreatedToken: true,
    hasRecentRun: false,
    hasMetricSetup: false,
  })

  assert.deepEqual(
    steps.map((step) => ({ id: step.id, status: step.status })),
    [
      { id: "select-node", status: "done" },
      { id: "create-token", status: "done" },
      { id: "configure-provider", status: "current" },
      { id: "send-test", status: "waiting" },
      { id: "verify-run", status: "waiting" },
    ]
  )
})

test("buildIntegrationWizardSteps uses provider-specific telemetry actions", () => {
  const difySteps = buildIntegrationWizardSteps({
    setupKind: "telemetry",
    providerId: "dify",
    hasSelectedNode: true,
    hasCreatedToken: true,
    hasRecentRun: false,
    hasMetricSetup: false,
  })
  const sdkSteps = buildIntegrationWizardSteps({
    setupKind: "telemetry",
    providerId: "javascript-sdk",
    hasSelectedNode: true,
    hasCreatedToken: true,
    hasRecentRun: false,
    hasMetricSetup: false,
  })

  assert.equal(difySteps[2].title, "Configure Dify")
  assert.equal(difySteps[3].title, "Run Dify once")
  assert.equal(sdkSteps[2].title, "Install JavaScript SDK")
  assert.equal(sdkSteps[3].title, "Run SDK test")
})

test("buildIntegrationWizardSteps waits for real metric evidence after saved mappings", () => {
  const steps = buildIntegrationWizardSteps({
    setupKind: "metric",
    providerId: "custom-rest-metric",
    hasSelectedNode: true,
    hasCreatedToken: false,
    hasRecentRun: false,
    hasMetricSetup: true,
    hasMetricSample: false,
  })

  assert.deepEqual(
    steps.map((step) => ({ id: step.id, status: step.status })),
    [
      { id: "select-node", status: "done" },
      { id: "configure-api", status: "done" },
      { id: "test-endpoint", status: "done" },
      { id: "verify-sample", status: "current" },
    ]
  )
})

test("buildIntegrationWizardSteps marks metric sample verification from persisted samples", () => {
  const steps = buildIntegrationWizardSteps({
    setupKind: "metric",
    providerId: "custom-rest-metric",
    hasSelectedNode: true,
    hasCreatedToken: false,
    hasRecentRun: false,
    hasMetricSetup: true,
    hasMetricSample: true,
  })

  assert.deepEqual(
    steps.map((step) => ({ id: step.id, status: step.status })),
    [
      { id: "select-node", status: "done" },
      { id: "configure-api", status: "done" },
      { id: "test-endpoint", status: "done" },
      { id: "verify-sample", status: "done" },
    ]
  )
})

test("buildProviderSetupCopy returns Dify-specific setup guidance without real tokens", () => {
  const copy = buildProviderSetupCopy({ providerId: "dify", nodeId: "node_123" })

  assert.match(copy.codeNode, /def main\(node_id: str, workflow_run_id: str/)
  assert.match(copy.httpRequest, /Authorization: Bearer <ingestion-token>/)
  assert.match(copy.httpRequest, /Code\.result/)
  assert.match(copy.codeNode, /node_id/)
  assert.equal(copy.codeNode.includes("mdn_"), false)
  assert.equal(copy.httpRequest.includes("mdn_"), false)
})

test("buildProviderSetupCopy returns JavaScript SDK guidance without real tokens", () => {
  const copy = buildProviderSetupCopy({ providerId: "javascript-sdk", nodeId: "node_123" })

  assert.match(copy.codeNode, /npm install @meridian-workflows\/sdk/)
  assert.match(copy.httpRequest, /MERIDIAN_NODE_ID=node_123/)
  assert.equal(copy.codeNode.includes("mdn_"), false)
  assert.equal(copy.httpRequest.includes("mdn_"), false)
})
