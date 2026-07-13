import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  FIRST_WORKFLOW_TUTORIAL_STORAGE_KEY,
  TUTORIAL_WIDGET_COLLAPSED_STORAGE_KEY,
  TUTORIAL_WIDGET_PLACEMENT_STORAGE_KEY,
  buildFirstWorkflowTutorialProgress,
  firstWorkflowTutorialSteps,
  getFirstWorkflowTutorialStartIndex,
  isTutorialDismissed,
  snapTutorialWidgetPlacement,
  shouldAutoStartFirstWorkflowTutorial,
} from "../src/lib/tutorial.mjs"

test("firstWorkflowTutorialSteps keeps the core setup order stable", () => {
  assert.equal(FIRST_WORKFLOW_TUTORIAL_STORAGE_KEY, "meridian-tutorial:first-workflow:v1")
  assert.equal(TUTORIAL_WIDGET_PLACEMENT_STORAGE_KEY, "meridian-tutorial:first-workflow:widget-placement:v1")
  assert.equal(TUTORIAL_WIDGET_COLLAPSED_STORAGE_KEY, "meridian-tutorial:first-workflow:widget-collapsed:v1")
  assert.deepEqual(
    firstWorkflowTutorialSteps.map((step) => ({ id: step.id, section: step.section, targetId: step.targetId, completionKind: step.completionKind ?? null })),
    [
      { id: "open-map", section: "map", targetId: "map-canvas", completionKind: "visited-step" },
      { id: "add-node", section: "map", targetId: "map-add-node", completionKind: "node-exists" },
      { id: "select-node", section: "map", targetId: "map-inspector", completionKind: "selected-node" },
      { id: "open-integrations", section: "integrations", targetId: "integrations-templates", completionKind: "visited-step" },
      { id: "choose-rest-template", section: "integrations", targetId: "integrations-template-custom-rest-metric", completionKind: "selected-node" },
      { id: "open-api-setup", section: "map", targetId: "node-api-setup-action", completionKind: "selected-node" },
      { id: "configure-endpoint", section: "map", targetId: "api-setup-endpoint-url", completionKind: "rest-setup-saved" },
      { id: "configure-jsonpath", section: "map", targetId: "api-setup-jsonpath", completionKind: "rest-setup-saved" },
      { id: "test-endpoint", section: "map", targetId: "api-setup-test-endpoint", completionKind: "rest-setup-saved" },
      { id: "save-api-setup", section: "map", targetId: "api-setup-save", completionKind: "rest-setup-saved" },
      { id: "run-poll", section: "map", targetId: "rest-metric-first-poll", completionKind: "real-metric-sample" },
      { id: "verify-metric", section: "map", targetId: "node-metric-evidence", completionKind: "real-metric-sample" },
      { id: "create-report", section: "reports", targetId: "reports-create-link", completionKind: "report-link" },
    ]
  )
})

test("getFirstWorkflowTutorialStartIndex uses project evidence", () => {
  assert.equal(getFirstWorkflowTutorialStartIndex({ nodeCount: 0, runCount: 0, metricCount: 0, activeReportCount: 0 }), 0)
  assert.equal(getFirstWorkflowTutorialStartIndex({ nodeCount: 1, runCount: 0, metricCount: 0, activeReportCount: 0 }), 3)
  assert.equal(getFirstWorkflowTutorialStartIndex({ nodeCount: 1, runCount: 1, metricCount: 0, activeReportCount: 0 }), 11)
  assert.equal(getFirstWorkflowTutorialStartIndex({ nodeCount: 1, runCount: 1, metricCount: 1, activeReportCount: 1 }), 12)
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

  assert.deepEqual(progress.completedStepIds, ["add-node", "select-node", "choose-rest-template", "open-api-setup", "run-poll", "verify-metric", "create-report"])
  assert.equal(progress.completedCount, 7)
  assert.equal(progress.totalCount, 13)
  assert.equal(progress.percent, 54)
})

test("buildFirstWorkflowTutorialProgress waits for new signal evidence after tutorial start", () => {
  const progress = buildFirstWorkflowTutorialProgress({
    startEvidence: { nodeCount: 1, runCount: 0, metricCount: 0, activeReportCount: 0 },
    currentEvidence: { nodeCount: 1, runCount: 0, metricCount: 0, activeReportCount: 0 },
  })

  assert.deepEqual(progress.completedStepIds, ["add-node", "select-node", "choose-rest-template", "open-api-setup"])
  assert.equal(progress.completedCount, 4)
  assert.equal(progress.percent, 31)
})

test("buildFirstWorkflowTutorialProgress completes REST metric evidence from real samples only", () => {
  const progress = buildFirstWorkflowTutorialProgress({
    startEvidence: { nodeCount: 1, runCount: 0, metricCount: 0, activeReportCount: 0 },
    currentEvidence: { nodeCount: 1, runCount: 0, metricCount: 1, activeReportCount: 0 },
  })

  assert.equal(progress.completedStepIds.includes("run-poll"), true)
  assert.equal(progress.completedStepIds.includes("verify-metric"), true)
  assert.equal(progress.completedStepIds.includes("create-report"), false)
})

test("buildFirstWorkflowTutorialProgress completes navigation steps after they are visited", () => {
  const progress = buildFirstWorkflowTutorialProgress({
    startEvidence: { nodeCount: 0, runCount: 0, metricCount: 0, activeReportCount: 0 },
    currentEvidence: {
      nodeCount: 0,
      runCount: 0,
      metricCount: 0,
      activeReportCount: 0,
      visitedStepIds: ["open-map", "open-integrations"],
    },
  })

  assert.deepEqual(progress.completedStepIds, ["open-map", "open-integrations"])
  assert.equal(progress.completedCount, 2)
})

test("snapTutorialWidgetPlacement chooses nearest safe placement", () => {
  const viewport = { width: 1200, height: 800 }
  const widget = { width: 420, height: 320 }

  assert.equal(snapTutorialWidgetPlacement({ x: 600, y: 760 }, viewport, widget), "bottom-center")
  assert.equal(snapTutorialWidgetPlacement({ x: 70, y: 90 }, viewport, widget), "top-left")
  assert.equal(snapTutorialWidgetPlacement({ x: 1160, y: 110 }, viewport, widget), "top-right")
  assert.equal(snapTutorialWidgetPlacement({ x: 40, y: 420 }, viewport, widget), "left-center")
  assert.equal(snapTutorialWidgetPlacement({ x: 1180, y: 460 }, viewport, widget), "right-center")
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
  assert.doesNotMatch(dashboardSource, /bg-black\/50/)
  assert.match(dashboardSource, /data-tutorial-active/)
  assert.match(dashboardSource, /pointer-events-auto fixed z-\[62\]/)
  assert.doesNotMatch(dashboardSource, /onPointerDown=\{\(event\)/)
})

test("dashboard exposes granular REST metric tutorial anchors", () => {
  const dashboardSource = readFileSync(new URL("../src/components/meridian/dashboard.tsx", import.meta.url), "utf8")

  for (const targetId of firstWorkflowTutorialSteps.map((step) => step.targetId)) {
    assert.match(dashboardSource, new RegExp(`data-tutorial-id="${targetId}"`))
  }

  assert.match(dashboardSource, /Show tutorial \^/)
  assert.match(dashboardSource, /Hide tutorial/)
})
