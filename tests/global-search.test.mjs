import assert from "node:assert/strict"
import { test } from "node:test"

import { buildGlobalSearchIndex, searchGlobalIndex } from "../src/lib/global-search.mjs"

const sections = [
  { id: "map", label: "Automation Map", description: "Graph-first dependency canvas" },
  { id: "runs", label: "Runs", description: "Workflow execution telemetry" },
  { id: "alerts", label: "Alerts", description: "Active incidents and delivery status" },
  { id: "logs", label: "Logs", description: "Unified operational timeline" },
]

test("buildGlobalSearchIndex creates safe project navigation results", () => {
  const index = buildGlobalSearchIndex({
    sections,
    nodes: [
      {
        id: "node_support",
        label: "Portfolio Shadow Chatbot",
        vendor: "Dify",
        status: "active",
      },
    ],
    alerts: [
      {
        id: "alert_1",
        title: "Token spike",
        severity: "warning",
        status: "OPEN",
        nodeLabel: "Portfolio Shadow Chatbot",
      },
    ],
    runs: [
      {
        id: "run_1",
        externalId: "dify-run-123",
        status: "success",
        nodeId: "node_support",
        nodeLabel: "Portfolio Shadow Chatbot",
      },
    ],
    reports: [{ id: "report_1", title: "June Client Review", clientName: "Acme" }],
    jobs: [{ id: "job_1", channel: "slack", eventType: "alert.opened", status: "FAILED", recipient: "#ops" }],
    canEditProject: true,
    canManageOrganization: true,
  })

  assert.ok(index.some((result) => result.id === "node:node_support" && result.section === "map"))
  assert.ok(index.some((result) => result.id === "alert:alert_1" && result.section === "alerts"))
  assert.ok(index.some((result) => result.id === "run:run_1" && result.section === "runs"))
  assert.ok(index.some((result) => result.id === "report:report_1" && result.section === "reports"))
  assert.ok(index.some((result) => result.id === "job:job_1" && result.section === "testing"))
  assert.ok(index.some((result) => result.id === "action:create-token" && result.section === "integrations"))
  assert.equal(index.some((result) => JSON.stringify(result).includes("mdn_")), false)
})

test("searchGlobalIndex matches all query terms and caps results", () => {
  const index = buildGlobalSearchIndex({
    sections,
    nodes: [
      { id: "node_support", label: "Portfolio Shadow Chatbot", vendor: "Dify", status: "active" },
      { id: "node_invoice", label: "Invoice Agent", vendor: "n8n", status: "degraded" },
    ],
    alerts: [],
    runs: [],
    reports: [],
    jobs: [],
    canEditProject: false,
    canManageOrganization: false,
  })

  const results = searchGlobalIndex(index, "shadow dify", 2)

  assert.equal(results.length, 1)
  assert.equal(results[0].id, "node:node_support")
  assert.equal(searchGlobalIndex(index, "agent", 1).length, 1)
})

test("searchGlobalIndex returns high priority suggestions for blank queries", () => {
  const index = buildGlobalSearchIndex({
    sections,
    nodes: [{ id: "node_support", label: "Portfolio Shadow Chatbot", vendor: "Dify", status: "active" }],
    alerts: [],
    runs: [],
    reports: [],
    jobs: [],
    canEditProject: true,
    canManageOrganization: false,
  })

  const results = searchGlobalIndex(index, "   ", 4)

  assert.ok(results.length > 0)
  assert.equal(results[0].type, "section")
  assert.ok(results.some((result) => result.id === "action:open-dify"))
}
)
