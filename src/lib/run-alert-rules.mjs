/**
 * Pure workflow-run alert evaluation used by ingestion and tests.
 */

const NUMERIC_EXPRESSION_PATTERN = /^(>=|>|<=|<|=)\s*(-?\d+(?:\.\d+)?)$/
const RUN_RULE_METRICS = new Set(["status", "durationMs", "costUsd", "tokens", "failureRate", "averageDurationMs"])

/**
 * @param {unknown} metadata
 * @returns {{ source: string, runMetric: string | null, windowRuns: number }}
 */
export function normalizeRunAlertMetadata(metadata) {
  const record = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {}
  const runRecord = record.run && typeof record.run === "object" && !Array.isArray(record.run) ? record.run : {}
  const runMetric = typeof runRecord.metric === "string" ? runRecord.metric : typeof record.runMetric === "string" ? record.runMetric : null
  const parsedWindow = Number(runRecord.windowRuns ?? record.windowRuns ?? 1)

  return {
    source: record.source === "run" ? "run" : "metric",
    runMetric: RUN_RULE_METRICS.has(runMetric) ? runMetric : null,
    windowRuns: Number.isFinite(parsedWindow) ? Math.max(1, Math.min(100, Math.round(parsedWindow))) : 1,
  }
}

/**
 * @param {string} expression
 * @returns {{ operator: string, value: number } | null}
 */
export function parseRunAlertExpression(expression) {
  const match = NUMERIC_EXPRESSION_PATTERN.exec(String(expression ?? "").trim())
  if (!match) return null
  return { operator: match[1], value: Number(match[2]) }
}

function compareValue(actual, expression) {
  const parsed = parseRunAlertExpression(expression)
  if (!parsed || actual === null || actual === undefined || !Number.isFinite(Number(actual))) return false
  const value = Number(actual)
  switch (parsed.operator) {
    case ">":
      return value > parsed.value
    case ">=":
      return value >= parsed.value
    case "<":
      return value < parsed.value
    case "<=":
      return value <= parsed.value
    case "=":
      return value === parsed.value
    default:
      return false
  }
}

function durationMs(run) {
  if (typeof run.durationMs === "number" && Number.isFinite(run.durationMs)) return Math.max(0, run.durationMs)
  const startedAt = Date.parse(String(run.startedAt ?? ""))
  const finishedAt = Date.parse(String(run.finishedAt ?? ""))
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) return null
  return Math.max(0, finishedAt - startedAt)
}

function numberOrNull(value) {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function recentWindow(runs, windowRuns) {
  return runs.slice(0, windowRuns)
}

function valueForMetric(metric, run, recentRuns, windowRuns) {
  if (metric === "status") return String(run.status ?? "").toLowerCase()
  if (metric === "durationMs") return durationMs(run)
  if (metric === "costUsd") return numberOrNull(run.costUsd)
  if (metric === "tokens") return numberOrNull(run.tokens)

  const window = recentWindow(recentRuns, windowRuns)
  if (!window.length) return null

  if (metric === "failureRate") {
    const badRuns = window.filter((candidate) => {
      const status = String(candidate.status ?? "").toLowerCase()
      return status === "failed" || status === "degraded"
    }).length
    return Math.round((badRuns / window.length) * 100)
  }

  if (metric === "averageDurationMs") {
    const durations = window.map(durationMs).filter((duration) => duration !== null)
    if (!durations.length) return null
    return Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length)
  }

  return null
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value)
}

function metricLabel(metric) {
  switch (metric) {
    case "durationMs":
      return "run duration"
    case "costUsd":
      return "run cost"
    case "tokens":
      return "token usage"
    case "failureRate":
      return "failure rate"
    case "averageDurationMs":
      return "average latency"
    default:
      return "run status"
  }
}

function unitForMetric(metric) {
  if (metric === "durationMs" || metric === "averageDurationMs") return "ms"
  if (metric === "failureRate") return "%"
  if (metric === "costUsd") return " USD"
  return ""
}

/**
 * Evaluates one alert rule against a newly persisted workflow run.
 *
 * @param {{ id: string, name: string, expression: string, severity: string, metadata: unknown }} rule
 * @param {{ run: Record<string, unknown>, recentRuns: Record<string, unknown>[], nodeLabel?: string }} input
 * @returns {{ breached: boolean, title?: string, message?: string, reason?: string }}
 */
export function evaluateRunAlertRule(rule, input) {
  const metadata = normalizeRunAlertMetadata(rule.metadata)
  if (metadata.source !== "run") return { breached: false, reason: "not-run-rule" }
  if (!metadata.runMetric) return { breached: false, reason: "missing-run-metric" }

  const value = valueForMetric(metadata.runMetric, input.run, input.recentRuns, metadata.windowRuns)
  if (metadata.runMetric === "status") {
    const breached = value === "failed" || value === "degraded"
    return breached
      ? {
          breached: true,
          title: rule.name,
          message: `${input.nodeLabel ?? "Workflow"} submitted a ${value} run.`,
        }
      : { breached: false, reason: "status-ok" }
  }

  if (!compareValue(value, rule.expression)) return { breached: false, reason: "threshold-ok" }

  const unit = unitForMetric(metadata.runMetric)
  const expression = String(rule.expression ?? "").trim()
  return {
    breached: true,
    title: rule.name,
    message: `${input.nodeLabel ?? "Workflow"} ${metricLabel(metadata.runMetric)} is ${formatNumber(Number(value))}${unit} (${expression}) across ${metadata.windowRuns} ${metadata.windowRuns === 1 ? "run" : "runs"}.`,
  }
}
