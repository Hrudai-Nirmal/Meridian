import assert from "node:assert/strict"
import { test } from "node:test"

import { buildFirstWorkflowLaunchpad } from "../src/lib/first-workflow-launchpad.mjs"

test("buildFirstWorkflowLaunchpad starts blank projects at node creation", () => {
  const steps = buildFirstWorkflowLaunchpad({
    nodeCount: 0,
    runCount: 0,
    metricCount: 0,
    activeReportCount: 0,
    activeAlertCount: 0,
  })

  assert.deepEqual(
    steps.map((step) => ({ id: step.id, status: step.status, section: step.section })),
    [
      { id: "create-node", status: "current", section: "map" },
      { id: "connect-workflow", status: "waiting", section: "integrations" },
      { id: "verify-ops", status: "waiting", section: "runs" },
      { id: "share-proof", status: "waiting", section: "reports" },
    ]
  )
})

test("buildFirstWorkflowLaunchpad points node-created projects at integrations", () => {
  const steps = buildFirstWorkflowLaunchpad({
    nodeCount: 2,
    runCount: 0,
    metricCount: 0,
    activeReportCount: 0,
    activeAlertCount: 0,
  })

  assert.equal(steps[0].status, "done")
  assert.equal(steps[1].status, "current")
  assert.match(steps[1].body, /Create a telemetry token/)
})

test("buildFirstWorkflowLaunchpad moves telemetry-ready projects toward client proof", () => {
  const steps = buildFirstWorkflowLaunchpad({
    nodeCount: 1,
    runCount: 3,
    metricCount: 0,
    activeReportCount: 0,
    activeAlertCount: 0,
  })

  assert.equal(steps[1].status, "done")
  assert.equal(steps[2].status, "done")
  assert.equal(steps[3].status, "current")
  assert.equal(steps[3].section, "reports")
})

test("buildFirstWorkflowLaunchpad marks report sharing complete", () => {
  const steps = buildFirstWorkflowLaunchpad({
    nodeCount: 1,
    runCount: 3,
    metricCount: 2,
    activeReportCount: 1,
    activeAlertCount: 1,
  })

  assert.equal(steps.every((step) => step.status === "done"), true)
  assert.match(steps[2].body, /1 active alert/)
})
