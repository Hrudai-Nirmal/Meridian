import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { getRealMetricSummaries, getRealWorkflowRuns } from "../src/lib/telemetry-evidence.mjs"

test("getRealWorkflowRuns excludes sample fallback rows", () => {
  const runs = getRealWorkflowRuns([
    {
      id: "node-fallback",
      label: "Fallback node",
      hasPersistedRuns: false,
      runs: [
        {
          id: "sample-run",
          status: "success",
          startedAt: "2026-07-12T10:00:00.000Z",
        },
      ],
    },
    {
      id: "node-real",
      label: "Real node",
      hasPersistedRuns: true,
      runs: [
        {
          id: "real-run",
          status: "success",
          startedAt: "2026-07-12T10:01:00.000Z",
        },
      ],
    },
  ])

  assert.deepEqual(runs, [
    {
      id: "real-run",
      status: "success",
      startedAt: "2026-07-12T10:01:00.000Z",
      nodeId: "node-real",
      nodeLabel: "Real node",
    },
  ])
})

test("getRealMetricSummaries returns only persisted metric summaries", () => {
  const metrics = getRealMetricSummaries([
    {
      id: "node-fallback",
      label: "Fallback node",
      realMetrics: [],
    },
    {
      id: "node-real",
      label: "Real node",
      realMetrics: [
        {
          label: "Latency",
          value: 225,
          sampledAt: "2026-07-12T10:02:00.000Z",
        },
      ],
    },
  ])

  assert.deepEqual(metrics, [
    {
      label: "Latency",
      value: 225,
      sampledAt: "2026-07-12T10:02:00.000Z",
      nodeId: "node-real",
      nodeLabel: "Real node",
    },
  ])
})

test("dashboard tutorial evidence does not count raw fallback node runs", () => {
  const dashboardSource = readFileSync(new URL("../src/components/meridian/dashboard.tsx", import.meta.url), "utf8")

  assert.doesNotMatch(dashboardSource, /sum \+ node\.runs\.length/)
  assert.match(dashboardSource, /getRealWorkflowRuns\(workspace\.nodes\)\.length/)
})
