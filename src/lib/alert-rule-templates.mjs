/**
 * Alert rule templates keep Meridian's rule picker predictable while still
 * letting users edit the generated rule before saving it.
 */

const METRIC_THRESHOLD_DEFAULTS = {
  latency: "> 5000",
  score: "< 80",
  cost: "> 1",
  tokens: "> 10000",
  queue: "> 10",
  default: "> 90",
}

export const ALERT_RULE_TEMPLATES = [
  {
    id: "metric-threshold-high",
    source: "metric",
    category: "Metric sample",
    title: "Metric above threshold",
    description: "Open an incident when a saved API metric rises past a limit.",
    mode: "threshold",
    expression: "> 90",
    severity: "WARNING",
  },
  {
    id: "metric-threshold-low",
    source: "metric",
    category: "Metric sample",
    title: "Metric below threshold",
    description: "Open an incident when a score, quality, or availability metric drops.",
    mode: "threshold",
    expression: "< 80",
    severity: "WARNING",
  },
  {
    id: "metric-anomaly-high",
    source: "metric",
    category: "Metric sample",
    title: "High anomaly",
    description: "Detect a high spike against the recent metric baseline.",
    mode: "anomaly",
    anomalyDirection: "high",
    severity: "WARNING",
  },
  {
    id: "metric-anomaly-low",
    source: "metric",
    category: "Metric sample",
    title: "Low anomaly",
    description: "Detect a low dip against the recent metric baseline.",
    mode: "anomaly",
    anomalyDirection: "low",
    severity: "WARNING",
  },
  {
    id: "metric-anomaly-both",
    source: "metric",
    category: "Metric sample",
    title: "Two-sided anomaly",
    description: "Detect either a high spike or low dip against the baseline.",
    mode: "anomaly",
    anomalyDirection: "both",
    severity: "WARNING",
  },
  {
    id: "run-failed-or-degraded",
    source: "run",
    category: "Workflow run",
    title: "Failed or degraded run",
    description: "Open an incident whenever submitted workflow telemetry is not successful.",
    expression: "!= success",
    runMetric: "status",
    windowRuns: 1,
    severity: "CRITICAL",
  },
  {
    id: "run-duration-high",
    source: "run",
    category: "Workflow run",
    title: "Run duration high",
    description: "Open an incident when one submitted run takes too long.",
    expression: "> 5000",
    runMetric: "durationMs",
    windowRuns: 1,
    severity: "WARNING",
  },
  {
    id: "run-cost-high",
    source: "run",
    category: "Workflow run",
    title: "Run cost high",
    description: "Open an incident when one submitted run exceeds the cost guardrail.",
    expression: "> 0.1",
    runMetric: "costUsd",
    windowRuns: 1,
    severity: "WARNING",
  },
  {
    id: "run-tokens-high",
    source: "run",
    category: "Workflow run",
    title: "Token usage high",
    description: "Open an incident when one submitted run uses too many tokens.",
    expression: "> 5000",
    runMetric: "tokens",
    windowRuns: 1,
    severity: "WARNING",
  },
  {
    id: "run-failure-rate-high",
    source: "run",
    category: "Workflow run",
    title: "Failure rate high",
    description: "Open an incident when recent submitted runs fail or degrade too often.",
    expression: "> 20",
    runMetric: "failureRate",
    windowRuns: 20,
    severity: "WARNING",
  },
  {
    id: "run-average-duration-high",
    source: "run",
    category: "Workflow run",
    title: "Average latency high",
    description: "Open an incident when recent submitted runs are slow on average.",
    expression: "> 5000",
    runMetric: "averageDurationMs",
    windowRuns: 20,
    severity: "WARNING",
  },
]

/**
 * Finds a rule template by its stable id.
 *
 * @param {string} templateId
 * @returns {(typeof ALERT_RULE_TEMPLATES)[number] | null}
 */
export function getAlertRuleTemplate(templateId) {
  return ALERT_RULE_TEMPLATES.find((template) => template.id === templateId) ?? null
}

function expressionForMetric(template, mappingLabel) {
  const normalizedLabel = String(mappingLabel ?? "").toLowerCase()
  if (template.id === "metric-threshold-low") return METRIC_THRESHOLD_DEFAULTS.score
  if (normalizedLabel.includes("latency") || normalizedLabel.includes("duration")) return METRIC_THRESHOLD_DEFAULTS.latency
  if (normalizedLabel.includes("score") || normalizedLabel.includes("quality")) return METRIC_THRESHOLD_DEFAULTS.score
  if (normalizedLabel.includes("cost")) return METRIC_THRESHOLD_DEFAULTS.cost
  if (normalizedLabel.includes("token")) return METRIC_THRESHOLD_DEFAULTS.tokens
  if (normalizedLabel.includes("queue")) return METRIC_THRESHOLD_DEFAULTS.queue
  return template.expression ?? METRIC_THRESHOLD_DEFAULTS.default
}

/**
 * Builds a draft alert-rule payload that the UI can show and edit before save.
 *
 * @param {string} templateId
 * @param {{ nodeId: string, nodeLabel?: string, mappingId?: string, mappingLabel?: string, unit?: string }} context
 * @returns {Record<string, unknown>}
 */
export function buildAlertRulePayloadFromTemplate(templateId, context) {
  const template = getAlertRuleTemplate(templateId)
  if (!template) throw new Error(`Unknown alert rule template: ${templateId}`)

  if (template.source === "run") {
    return {
      templateId: template.id,
      source: "run",
      nodeId: context.nodeId,
      mappingId: null,
      mappingLabel: null,
      name: template.title,
      expression: template.expression,
      mode: "threshold",
      runMetric: template.runMetric,
      windowRuns: template.windowRuns,
      severity: template.severity,
      enabled: true,
    }
  }

  return {
    templateId: template.id,
    source: "metric",
    nodeId: context.nodeId,
    mappingId: context.mappingId ?? "",
    mappingLabel: context.mappingLabel ?? "",
    name: `${context.mappingLabel ?? "Metric"} ${template.title.toLowerCase()}`,
    expression: template.mode === "anomaly" ? `anomaly:${template.anomalyDirection}` : expressionForMetric(template, context.mappingLabel),
    mode: template.mode,
    anomalyDirection: template.anomalyDirection ?? "high",
    runMetric: undefined,
    windowRuns: undefined,
    severity: template.severity,
    enabled: true,
  }
}
