import assert from "node:assert/strict"
import test from "node:test"

import {
  buildClientReportSummary,
  formatReportComparisonBadge,
  getFilteredIncidentTimeline,
} from "../src/lib/report-client-proof.mjs"

const report = {
  title: "July Operations Review",
  clientName: "Acme",
  projectName: "Support Automation",
  period: { label: "Last 30 days" },
  summary: {
    uptimePercent: 98,
    totalRuns: 120,
    successRate: 94,
    totalCostUsd: 12.45,
    totalTokens: 84000,
    activeAlerts: 1,
    qualityScore: 96,
  },
  comparison: {
    label: "Previous 30 days",
    summary: {
      totalRuns: 100,
      successRate: 90,
      totalCostUsd: 10.1,
      totalTokens: 76000,
      activeAlerts: 3,
      qualityScore: 91,
    },
  },
}

test("formatReportComparisonBadge explains direction and tone", () => {
  assert.deepEqual(formatReportComparisonBadge({ current: 94, previous: 90, unit: " pts", higherIsBetter: true }), {
    label: "+4 pts vs previous period",
    tone: "good",
  })
  assert.deepEqual(formatReportComparisonBadge({ current: 1, previous: 3, higherIsBetter: false }), {
    label: "-2 vs previous period",
    tone: "good",
  })
})

test("formatReportComparisonBadge handles no previous data", () => {
  assert.deepEqual(formatReportComparisonBadge({ current: 10, previous: 10 }), {
    label: "No change vs previous period",
    tone: "neutral",
  })
})

test("buildClientReportSummary creates copyable secret-safe client text", () => {
  const summary = buildClientReportSummary(report)

  assert.match(summary, /July Operations Review/)
  assert.match(summary, /Acme/)
  assert.match(summary, /Last 30 days/)
  assert.match(summary, /120 workflow runs/)
  assert.doesNotMatch(summary, /token:|secret|authorization|bearer|webhook|hooks\.slack\.com/i)
})

test("getFilteredIncidentTimeline filters active and resolved rows", () => {
  const incidents = [
    { id: "a", status: "active", title: "Open incident" },
    { id: "b", status: "resolved", title: "Resolved incident" },
  ]

  assert.deepEqual(getFilteredIncidentTimeline(incidents, "all").map((item) => item.id), ["a", "b"])
  assert.deepEqual(getFilteredIncidentTimeline(incidents, "active").map((item) => item.id), ["a"])
  assert.deepEqual(getFilteredIncidentTimeline(incidents, "resolved").map((item) => item.id), ["b"])
})
