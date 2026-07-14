import assert from "node:assert/strict"
import test from "node:test"

import {
  ALERT_RULE_TEMPLATES,
  buildAlertRulePayloadFromTemplate,
  getAlertRuleTemplate,
} from "../src/lib/alert-rule-templates.mjs"

test("alert rule template ids stay stable", () => {
  assert.deepEqual(
    ALERT_RULE_TEMPLATES.map((template) => template.id),
    [
      "metric-threshold-high",
      "metric-threshold-low",
      "metric-anomaly-high",
      "metric-anomaly-low",
      "metric-anomaly-both",
      "run-failed-or-degraded",
      "run-duration-high",
      "run-cost-high",
      "run-tokens-high",
      "run-failure-rate-high",
      "run-average-duration-high",
    ]
  )
})

test("metric templates produce existing metric-rule payloads", () => {
  const payload = buildAlertRulePayloadFromTemplate("metric-threshold-high", {
    nodeId: "node_1",
    nodeLabel: "Checkout Agent",
    mappingId: "mapping_1",
    mappingLabel: "Latency",
    unit: "ms",
  })

  assert.equal(payload.source, "metric")
  assert.equal(payload.mode, "threshold")
  assert.equal(payload.mappingId, "mapping_1")
  assert.equal(payload.mappingLabel, "Latency")
  assert.equal(payload.expression, "> 5000")
  assert.equal(payload.runMetric, undefined)
})

test("metric templates can prefill before a mapping is persisted", () => {
  const payload = buildAlertRulePayloadFromTemplate("metric-threshold-high", {
    nodeId: "node_1",
    nodeLabel: "Checkout Agent",
    mappingLabel: "Draft latency",
    unit: "ms",
  })

  assert.equal(payload.source, "metric")
  assert.equal(payload.mappingId, "")
  assert.equal(payload.mappingLabel, "Draft latency")
  assert.match(String(payload.name), /Draft latency/)
})

test("run templates produce run-rule metadata payloads", () => {
  const payload = buildAlertRulePayloadFromTemplate("run-failure-rate-high", {
    nodeId: "node_1",
    nodeLabel: "Support Triage Agent",
  })

  assert.equal(payload.source, "run")
  assert.equal(payload.templateId, "run-failure-rate-high")
  assert.equal(payload.runMetric, "failureRate")
  assert.equal(payload.windowRuns, 20)
  assert.equal(payload.mappingId, null)
  assert.match(payload.expression, /^> /)
})

test("alert rule template copy is secret safe", () => {
  const serialized = JSON.stringify(ALERT_RULE_TEMPLATES)

  assert.doesNotMatch(serialized, /sk-[a-z0-9]|secret|password|authorization|bearer\s+[a-z0-9]|hooks\.slack\.com/i)
})

test("missing alert rule templates fail clearly", () => {
  assert.equal(getAlertRuleTemplate("does-not-exist"), null)
})
