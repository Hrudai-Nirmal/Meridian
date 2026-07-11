import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  FIRST_WORKFLOW_TUTORIAL_STORAGE_KEY,
  buildFirstWorkflowTutorialProgress,
  firstWorkflowTutorialSteps,
  getFirstWorkflowTutorialStartIndex,
  isTutorialDismissed,
  shouldAutoStartFirstWorkflowTutorial,
} from "../src/lib/tutorial.mjs"

test("firstWorkflowTutorialSteps keeps the core setup order stable", () => {
  assert.equal(FIRST_WORKFLOW_TUTORIAL_STORAGE_KEY, "meridian-tutorial:first-workflow:v1")
  assert.deepEqual(
    firstWorkflowTutorialSteps.map((step) => ({ id: step.id, section: step.section, targetId: step.targetId })),
    [
      { id: "map-node", section: "map", targetId: "map-canvas" },
      { id: "integration-template", section: "integrations", targetId: "integrations-templates" },
      { id: "telemetry-test", section: "integrations", targetId: "integrations-telemetry-test" },
      { id: "verify-runs", section: "runs", targetId: "runs-table" },
      { id: "client-proof", section: "reports", targetId: "reports-preview" },
    ]
  )
})

test("getFirstWorkflowTutorialStartIndex uses project evidence", () => {
  assert.equal(getFirstWorkflowTutorialStartIndex({ nodeCount: 0, runCount: 0, metricCount: 0, activeReportCount: 0 }), 0)
  assert.equal(getFirstWorkflowTutorialStartIndex({ nodeCount: 1, runCount: 0, metricCount: 0, activeReportCount: 0 }), 1)
  assert.equal(getFirstWorkflowTutorialStartIndex({ nodeCount: 1, runCount: 1, metricCount: 0, activeReportCount: 0 }), 3)
  assert.equal(getFirstWorkflowTutorialStartIndex({ nodeCount: 1, runCount: 1, metricCount: 1, activeReportCount: 1 }), 4)
})

test("isTutorialDismissed treats completed and skipped as dismissed", () => {
  assert.equal(isTutorialDismissed("completed"), true)
  assert.equal(isTutorialDismissed("skipped"), true)
  assert.equal(isTutorialDismissed(""), false)
  assert.equal(isTutorialDismissed(null), false)
})

test("shouldAutoStartFirstWorkflowTutorial only starts for undismissed projects without telemetry", () => {
  assert.equal(shouldAutoStartFirstWorkflowTutorial({ storageValue: null, runCount: 0, metricCount: 0 }), true)
  assert.equal(shouldAutoStartFirstWorkflowTutorial({ storageValue: "completed", runCount: 0, metricCount: 0 }), false)
  assert.equal(shouldAutoStartFirstWorkflowTutorial({ storageValue: "skipped", runCount: 0, metricCount: 0 }), false)
  assert.equal(shouldAutoStartFirstWorkflowTutorial({ storageValue: null, runCount: 1, metricCount: 0 }), false)
  assert.equal(shouldAutoStartFirstWorkflowTutorial({ storageValue: null, runCount: 0, metricCount: 1 }), false)
})

test("buildFirstWorkflowTutorialProgress advances from observable evidence", () => {
  const progress = buildFirstWorkflowTutorialProgress({
    startEvidence: { nodeCount: 0, runCount: 0, metricCount: 0, activeReportCount: 0 },
    currentEvidence: { nodeCount: 1, runCount: 1, metricCount: 0, activeReportCount: 1 },
  })

  assert.deepEqual(progress.completedStepIds, ["map-node", "integration-template", "telemetry-test", "verify-runs", "client-proof"])
  assert.equal(progress.completedCount, 5)
  assert.equal(progress.totalCount, 5)
  assert.equal(progress.percent, 100)
})

test("buildFirstWorkflowTutorialProgress waits for new signal evidence after tutorial start", () => {
  const progress = buildFirstWorkflowTutorialProgress({
    startEvidence: { nodeCount: 1, runCount: 0, metricCount: 0, activeReportCount: 0 },
    currentEvidence: { nodeCount: 1, runCount: 0, metricCount: 0, activeReportCount: 0 },
  })

  assert.deepEqual(progress.completedStepIds, ["map-node", "integration-template"])
  assert.equal(progress.completedCount, 2)
  assert.equal(progress.percent, 40)
})

test("tutorial copy stays secret-safe", () => {
  const serialized = JSON.stringify(firstWorkflowTutorialSteps)

  assert.equal(serialized.includes("mdn_"), false)
  assert.equal(serialized.includes("hooks.slack.com"), false)
  assert.equal(serialized.includes("signing secret"), false)
  assert.equal(serialized.includes("ENCRYPTION_KEY"), false)
  assert.equal(serialized.includes("DATABASE_URL"), false)
})

test("tutorial overlay keeps the underlying app interactive", () => {
  const dashboardSource = readFileSync(new URL("../src/components/meridian/dashboard.tsx", import.meta.url), "utf8")

  assert.match(dashboardSource, /<div className="pointer-events-none fixed inset-0 z-\[60\]">/)
  assert.match(dashboardSource, /className="pointer-events-none fixed inset-0 bg-black\/50"/)
  assert.match(dashboardSource, /pointer-events-auto fixed z-\[62\]/)
  assert.doesNotMatch(dashboardSource, /onPointerDown=\{\(event\)/)
})
