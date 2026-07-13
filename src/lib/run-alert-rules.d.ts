export type RunAlertMetric = "status" | "durationMs" | "costUsd" | "tokens" | "failureRate" | "averageDurationMs"

export type RunAlertRuleLike = {
  id: string
  name: string
  expression: string
  severity: "INFO" | "WARNING" | "CRITICAL"
  metadata: unknown
}

export type RunAlertInputRun = {
  id?: string
  status?: string
  startedAt?: string | Date
  finishedAt?: string | Date | null
  durationMs?: number | null
  costUsd?: string | number | null
  tokens?: number | null
}

export type RunAlertEvaluation = {
  breached: boolean
  title?: string
  message?: string
  reason?: string
}

/**
 * Normalizes run-rule metadata from persisted AlertRule metadata.
 */
export function normalizeRunAlertMetadata(metadata: unknown): {
  source: "metric" | "run"
  runMetric: RunAlertMetric | null
  windowRuns: number
}

/**
 * Parses simple numeric threshold expressions for run-derived metrics.
 */
export function parseRunAlertExpression(expression: string): { operator: string; value: number } | null

/**
 * Evaluates one alert rule against a newly persisted workflow run.
 */
export function evaluateRunAlertRule(
  rule: RunAlertRuleLike,
  input: {
    run: RunAlertInputRun
    recentRuns: RunAlertInputRun[]
    nodeLabel?: string
  }
): RunAlertEvaluation
