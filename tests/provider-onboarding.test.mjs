import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  buildProviderFirstSignalStatus,
  getProviderOnboardingCopy,
} from "../src/lib/provider-onboarding.mjs"

test("getProviderOnboardingCopy returns provider-specific first signal copy", () => {
  assert.equal(getProviderOnboardingCopy("dify").signalReceivedLabel, "Real Dify run received")
  assert.equal(getProviderOnboardingCopy("n8n").signalReceivedLabel, "Real n8n run received")
  assert.equal(getProviderOnboardingCopy("github-actions").signalReceivedLabel, "GitHub Actions run received")
  assert.equal(getProviderOnboardingCopy("javascript-sdk").signalReceivedLabel, "SDK run received")
})

test("buildProviderFirstSignalStatus waits for token before telemetry setup", () => {
  const status = buildProviderFirstSignalStatus({
    providerId: "dify",
    hasSelectedNode: true,
    hasToken: false,
    hasRun: false,
  })

  assert.equal(status.stage, "create-token")
  assert.equal(status.badge, "Token needed")
  assert.equal(status.primaryAction, "Create token")
})

test("buildProviderFirstSignalStatus reports real provider run evidence", () => {
  const status = buildProviderFirstSignalStatus({
    providerId: "github-actions",
    hasSelectedNode: true,
    hasToken: true,
    hasRun: true,
    latestRun: {
      externalId: "gha-123",
      status: "success",
      startedAt: "2026-06-12T09:30:00.000Z",
    },
  })

  assert.equal(status.stage, "run-received")
  assert.equal(status.badge, "GitHub Actions run received")
  assert.equal(status.primaryAction, "Open Runs")
  assert.match(status.detail, /gha-123/)
})

test("provider onboarding copy stays secret-safe", () => {
  const serialized = JSON.stringify([
    getProviderOnboardingCopy("dify"),
    getProviderOnboardingCopy("n8n"),
    getProviderOnboardingCopy("github-actions"),
    getProviderOnboardingCopy("javascript-sdk"),
  ])

  assert.equal(serialized.includes("mdn_"), false)
  assert.equal(serialized.includes("hooks.slack.com"), false)
  assert.equal(serialized.includes("DATABASE_URL"), false)
})

test("dashboard exposes provider-specific first signal onboarding anchors", () => {
  const dashboardSource = readFileSync(new URL("../src/components/meridian/dashboard.tsx", import.meta.url), "utf8")

  assert.match(dashboardSource, /data-tutorial-id="integrations-provider-first-signal"/)
  assert.match(dashboardSource, /Provider first signal/)
  assert.match(dashboardSource, /Real Dify run received|providerFirstSignalStatus\.badge/)
})
