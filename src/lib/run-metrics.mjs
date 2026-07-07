const STATUS_SCORE = {
  success: 100,
  degraded: 70,
  running: 50,
  queued: 50,
  failed: 0,
}

/**
 * @typedef {"success" | "degraded" | "failed" | "running" | "queued"} RunStatus
 * @typedef {"good" | "warn" | "bad" | "neutral"} MetricTone
 * @typedef {{ label: string, value: string, delta: string, tone: MetricTone }} EndpointMetric
 * @typedef {{ status: RunStatus | string, startedAt?: string, finishedAt?: string | null, durationMs?: number | null, costUsd?: string | number | null }} RunMetricInput
 */

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

/**
 * @param {number} rate
 * @returns {"good" | "warn" | "bad"}
 */
function toneForSuccessRate(rate) {
  if (rate >= 90) return "good"
  if (rate >= 70) return "warn"
  return "bad"
}

/**
 * @param {number | null} latencyMs
 * @returns {"good" | "warn" | "bad" | "neutral"}
 */
function toneForLatency(latencyMs) {
  if (latencyMs === null) return "neutral"
  if (latencyMs <= 2_000) return "good"
  if (latencyMs <= 5_000) return "warn"
  return "bad"
}

/**
 * @param {number} score
 * @returns {"good" | "warn" | "bad"}
 */
function toneForScore(score) {
  if (score >= 90) return "good"
  if (score >= 50) return "warn"
  return "bad"
}

function startOfUtcDay(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function durationFromRun(run) {
  if (typeof run.durationMs === "number" && Number.isFinite(run.durationMs)) {
    return Math.max(0, run.durationMs)
  }

  const startedAt = Date.parse(run.startedAt ?? "")
  const finishedAt = Date.parse(run.finishedAt ?? "")
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) return null
  return Math.max(0, finishedAt - startedAt)
}

function formatDurationMs(durationMs) {
  if (durationMs === null) return "Running"
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)}s`
  return `${Math.round(durationMs / 60_000)}m`
}

function parseCostUsd(value) {
  if (value === null || value === undefined) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function formatCostUsd(value) {
  if (value >= 100) return `$${value.toFixed(0)}`
  return `$${value.toFixed(3)}`
}

/**
 * Builds node summary metric cards from persisted workflow runs.
 *
 * Run telemetry should replace seeded demo metrics as soon as a node has real
 * workflow evidence. Metric samples still have their own higher-fidelity card
 * path for polled API values.
 *
 * @param {RunMetricInput[]} runs
 * @param {{ now?: Date }} options
 * @returns {EndpointMetric[]}
 */
export function buildRunDerivedMetricCards(runs, options = {}) {
  const now = options.now ?? new Date()
  const totalRuns = runs.length
  const successfulRuns = runs.filter((run) => run.status === "success").length
  const successRate = totalRuns ? Math.round((successfulRuns / totalRuns) * 100) : 0
  const completedDurations = runs.map(durationFromRun).filter((duration) => duration !== null)
  const averageLatencyMs = completedDurations.length
    ? Math.round(completedDurations.reduce((sum, duration) => sum + duration, 0) / completedDurations.length)
    : null
  const todayStart = startOfUtcDay(now)
  const todayRuns = runs.filter((run) => {
    const startedAt = Date.parse(run.startedAt ?? "")
    return Number.isFinite(startedAt) && startedAt >= todayStart
  })
  const costToday = todayRuns.reduce((sum, run) => sum + parseCostUsd(run.costUsd), 0)
  const score = totalRuns
    ? Math.round(
        runs.reduce((sum, run) => {
          const normalizedStatus = String(run.status ?? "").toLowerCase()
          return sum + (STATUS_SCORE[normalizedStatus] ?? 50)
        }, 0) / totalRuns
      )
    : 0

  return [
    {
      label: "Success rate",
      value: `${successRate}%`,
      delta: `${successfulRuns}/${totalRuns} ${totalRuns === 1 ? "run" : "runs"}`,
      tone: toneForSuccessRate(successRate),
    },
    {
      label: "Avg latency",
      value: formatDurationMs(averageLatencyMs),
      delta: completedDurations.length ? `${pluralize(completedDurations.length, "completed run")}` : "No completed runs",
      tone: toneForLatency(averageLatencyMs),
    },
    {
      label: "Cost today",
      value: formatCostUsd(costToday),
      delta: `${pluralize(todayRuns.length, "run")} today`,
      tone: "neutral",
    },
    {
      label: "Eval score",
      value: String(score),
      delta: "From run status",
      tone: toneForScore(score),
    },
  ]
}
