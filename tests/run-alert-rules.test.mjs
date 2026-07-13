import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  evaluateRunAlertRule,
  parseRunAlertExpression,
} from "../src/lib/run-alert-rules.mjs"

const baseRun = {
  id: "run_1",
  status: "success",
  startedAt: "2026-07-14T10:00:00.000Z",
  finishedAt: "2026-07-14T10:00:03.000Z",
  costUsd: "0.01",
  tokens: 1200,
}

test("parseRunAlertExpression supports simple numeric thresholds", () => {
  assert.deepEqual(parseRunAlertExpression("> 5000"), { operator: ">", value: 5000 })
  assert.deepEqual(parseRunAlertExpression("<= 0.05"), { operator: "<=", value: 0.05 })
  assert.equal(parseRunAlertExpression("around 5"), null)
})

test("status run rule alerts on failed or degraded runs", () => {
  const evaluation = evaluateRunAlertRule(
    {
      id: "rule_1",
      name: "Run failed or degraded",
      expression: "!= success",
      severity: "CRITICAL",
      metadata: { source: "run", run: { metric: "status" } },
    },
    {
      run: { ...baseRun, status: "failed" },
      recentRuns: [baseRun],
      nodeLabel: "Support Triage",
    }
  )

  assert.equal(evaluation.breached, true)
  assert.equal(evaluation.title, "Run failed or degraded")
  assert.match(evaluation.message, /failed/)
})

test("duration run rule alerts from persisted run timestamps", () => {
  const evaluation = evaluateRunAlertRule(
    {
      id: "rule_1",
      name: "Run duration high",
      expression: "> 2000",
      severity: "WARNING",
      metadata: { source: "run", run: { metric: "durationMs" } },
    },
    {
      run: baseRun,
      recentRuns: [baseRun],
      nodeLabel: "Support Triage",
    }
  )

  assert.equal(evaluation.breached, true)
  assert.match(evaluation.message, /3,000ms/)
})

test("failure-rate run rule uses the configured recent-run window", () => {
  const recentRuns = [
    { ...baseRun, id: "run_1", status: "success" },
    { ...baseRun, id: "run_2", status: "failed" },
    { ...baseRun, id: "run_3", status: "degraded" },
    { ...baseRun, id: "run_4", status: "success" },
  ]
  const evaluation = evaluateRunAlertRule(
    {
      id: "rule_1",
      name: "Failure rate high",
      expression: "> 40",
      severity: "WARNING",
      metadata: { source: "run", run: { metric: "failureRate", windowRuns: 4 } },
    },
    {
      run: recentRuns[1],
      recentRuns,
      nodeLabel: "Support Triage",
    }
  )

  assert.equal(evaluation.breached, true)
  assert.match(evaluation.message, /50%/)
})

test("metric-source rules are ignored by run-rule evaluation", () => {
  const evaluation = evaluateRunAlertRule(
    {
      id: "rule_1",
      name: "Metric threshold",
      expression: "> 90",
      severity: "WARNING",
      metadata: { source: "metric" },
    },
    {
      run: baseRun,
      recentRuns: [baseRun],
      nodeLabel: "Support Triage",
    }
  )

  assert.equal(evaluation.breached, false)
  assert.equal(evaluation.reason, "not-run-rule")
})

test("polling source skips run-source alert rules", () => {
  const pollingSource = readFileSync(new URL("../src/lib/polling.ts", import.meta.url), "utf8")

  assert.match(pollingSource, /metadata\.source === "metric"/)
})
