import assert from "node:assert/strict"
import { test } from "node:test"

import { buildRunDerivedMetricCards } from "../src/lib/run-metrics.mjs"

test("buildRunDerivedMetricCards summarizes persisted workflow telemetry", () => {
  const now = new Date("2026-07-07T12:00:00.000Z")
  const metrics = buildRunDerivedMetricCards(
    [
      {
        status: "success",
        startedAt: "2026-07-07T11:59:57.000Z",
        finishedAt: "2026-07-07T12:00:00.000Z",
        durationMs: 3000,
        costUsd: "0.010",
      },
      {
        status: "degraded",
        startedAt: "2026-07-07T11:58:55.000Z",
        finishedAt: "2026-07-07T11:59:00.000Z",
        durationMs: 5000,
        costUsd: "0.020",
      },
      {
        status: "failed",
        startedAt: "2026-07-06T23:59:55.000Z",
        finishedAt: "2026-07-07T00:00:00.000Z",
        durationMs: 5000,
        costUsd: "0.030",
      },
    ],
    { now }
  )

  assert.deepEqual(metrics, [
    { label: "Success rate", value: "33%", delta: "1/3 runs", tone: "bad" },
    { label: "Avg latency", value: "4.3s", delta: "3 completed runs", tone: "warn" },
    { label: "Cost today", value: "$0.030", delta: "2 runs today", tone: "neutral" },
    { label: "Eval score", value: "57", delta: "From run status", tone: "warn" },
  ])
})

test("buildRunDerivedMetricCards handles missing durations and cost safely", () => {
  const metrics = buildRunDerivedMetricCards(
    [
      {
        status: "running",
        startedAt: "2026-07-07T12:00:00.000Z",
        finishedAt: null,
        durationMs: null,
        costUsd: null,
      },
    ],
    { now: new Date("2026-07-07T12:00:05.000Z") }
  )

  assert.deepEqual(metrics, [
    { label: "Success rate", value: "0%", delta: "0/1 run", tone: "bad" },
    { label: "Avg latency", value: "Running", delta: "No completed runs", tone: "neutral" },
    { label: "Cost today", value: "$0.000", delta: "1 run today", tone: "neutral" },
    { label: "Eval score", value: "50", delta: "From run status", tone: "warn" },
  ])
})
