import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  buildRestMetricOnboardingStatus,
  getLatestRealMetricEvidence,
} from "../src/lib/rest-metric-onboarding.mjs"

test("buildRestMetricOnboardingStatus guides users before setup is saved", () => {
  const status = buildRestMetricOnboardingStatus({
    hasSelectedNode: true,
    hasSavedMapping: false,
    realMetrics: [],
  })

  assert.equal(status.stage, "save-setup")
  assert.equal(status.badge, "API setup needed")
  assert.equal(status.primaryAction, "Save API setup")
  assert.equal(status.detail.includes("sample fallback"), false)
})

test("buildRestMetricOnboardingStatus prompts first poll after saved setup", () => {
  const status = buildRestMetricOnboardingStatus({
    hasSelectedNode: true,
    hasSavedMapping: true,
    realMetrics: [],
    latestPollStatus: "FAILED",
    latestPollError: "JSONPath $.health.score was not found.",
  })

  assert.equal(status.stage, "run-first-poll")
  assert.equal(status.badge, "Awaiting first real sample")
  assert.equal(status.primaryAction, "Run first poll")
  assert.match(status.detail, /JSONPath/)
})

test("buildRestMetricOnboardingStatus reports latest real metric evidence", () => {
  const status = buildRestMetricOnboardingStatus({
    hasSelectedNode: true,
    hasSavedMapping: true,
    realMetrics: [
      {
        label: "Older score",
        displayValue: "88 score",
        sampledAt: "2026-06-12T08:00:00.000Z",
      },
      {
        label: "Demo metric",
        displayValue: "94 score",
        sampledAt: "2026-06-12T09:30:00.000Z",
      },
    ],
  })

  assert.equal(status.stage, "real-sample-received")
  assert.equal(status.badge, "Real sample received")
  assert.equal(status.primaryAction, "Create report")
  assert.match(status.detail, /Demo metric/)
  assert.match(status.detail, /94 score/)
  assert.match(status.detail, /2026-06-12T09:30:00.000Z/)
})

test("getLatestRealMetricEvidence ignores missing and malformed sample dates", () => {
  assert.equal(getLatestRealMetricEvidence([]), null)
  assert.deepEqual(
    getLatestRealMetricEvidence([
      { label: "No date", displayValue: "10", sampledAt: "" },
      { label: "Good", displayValue: "11", sampledAt: "2026-06-12T09:30:00.000Z" },
    ]),
    { label: "Good", displayValue: "11", sampledAt: "2026-06-12T09:30:00.000Z" }
  )
})

test("dashboard exposes direct REST metric first-poll onboarding controls", () => {
  const dashboardSource = readFileSync(new URL("../src/components/meridian/dashboard.tsx", import.meta.url), "utf8")

  assert.match(dashboardSource, /data-tutorial-id="rest-metric-first-poll"/)
  assert.match(dashboardSource, /REST metric first signal/)
  assert.match(dashboardSource, /Real sample received/)
})
