import type { Prisma } from "@prisma/client"

export type AlertRuleMode = "threshold" | "anomaly"
export type AnomalyDirection = "high" | "low" | "both"
export type AlertRuleSource = "metric" | "run"
export type RunAlertMetric = "status" | "durationMs" | "costUsd" | "tokens" | "failureRate" | "averageDurationMs"

export const anomalyDefaults = {
  direction: "high" as AnomalyDirection,
  sigma: 2,
  windowDays: 7,
  minSamples: 8,
}

export type NormalizedAlertRuleMetadata = {
  source: AlertRuleSource
  mode: AlertRuleMode
  templateId: string | null
  nodeLabel: string | null
  mappingLabel: string | null
  anomaly: {
    direction: AnomalyDirection
    sigma: number
    windowDays: number
    minSamples: number
  } | null
  run: {
    metric: RunAlertMetric | null
    windowRuns: number
  } | null
}

function metadataRecord(metadata: unknown) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {}
}

function numberOrDefault(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function directionOrDefault(value: unknown): AnomalyDirection {
  return value === "low" || value === "both" || value === "high" ? value : anomalyDefaults.direction
}

function sourceOrDefault(value: unknown): AlertRuleSource {
  return value === "run" ? "run" : "metric"
}

function runMetricOrNull(value: unknown): RunAlertMetric | null {
  return value === "status" ||
    value === "durationMs" ||
    value === "costUsd" ||
    value === "tokens" ||
    value === "failureRate" ||
    value === "averageDurationMs"
    ? value
    : null
}

export function normalizeAlertRuleMetadata(metadata: unknown): NormalizedAlertRuleMetadata {
  const record = metadataRecord(metadata)
  const anomalyRecord = metadataRecord(record.anomaly)
  const runRecord = metadataRecord(record.run)
  const source = sourceOrDefault(record.source)
  const mode: AlertRuleMode = record.mode === "anomaly" ? "anomaly" : "threshold"
  const anomaly =
    mode === "anomaly"
      ? {
          direction: directionOrDefault(anomalyRecord.direction ?? record.anomalyDirection),
          sigma: numberOrDefault(anomalyRecord.sigma ?? record.sigma, anomalyDefaults.sigma, 0.5, 10),
          windowDays: numberOrDefault(anomalyRecord.windowDays ?? record.windowDays, anomalyDefaults.windowDays, 1, 30),
          minSamples: Math.round(numberOrDefault(anomalyRecord.minSamples ?? record.minSamples, anomalyDefaults.minSamples, 3, 1000)),
        }
      : null
  const run =
    source === "run"
      ? {
          metric: runMetricOrNull(runRecord.metric ?? record.runMetric),
          windowRuns: Math.round(numberOrDefault(runRecord.windowRuns ?? record.windowRuns, 1, 1, 100)),
        }
      : null

  return {
    source,
    mode,
    templateId: typeof record.templateId === "string" ? record.templateId : null,
    nodeLabel: typeof record.nodeLabel === "string" ? record.nodeLabel : null,
    mappingLabel: typeof record.mappingLabel === "string" ? record.mappingLabel : null,
    anomaly,
    run,
  }
}

export function buildAlertRuleMetadata(input: {
  source?: AlertRuleSource
  mode?: AlertRuleMode
  templateId?: string | null
  nodeLabel?: string | null
  mappingLabel?: string | null
  anomalyDirection?: AnomalyDirection
  sigma?: number
  windowDays?: number
  minSamples?: number
  runMetric?: RunAlertMetric | null
  windowRuns?: number | null
}): Prisma.InputJsonObject {
  const source = input.source ?? "metric"
  const mode = input.mode ?? "threshold"
  const metadata: Record<string, Prisma.InputJsonValue | null> = {
    source,
    mode,
    templateId: input.templateId ?? null,
    nodeLabel: input.nodeLabel ?? null,
    mappingLabel: input.mappingLabel ?? null,
  }

  if (mode === "anomaly") {
    metadata.anomaly = {
      direction: input.anomalyDirection ?? anomalyDefaults.direction,
      sigma: input.sigma ?? anomalyDefaults.sigma,
      windowDays: input.windowDays ?? anomalyDefaults.windowDays,
      minSamples: input.minSamples ?? anomalyDefaults.minSamples,
    }
  }

  if (source === "run") {
    metadata.run = {
      metric: input.runMetric ?? null,
      windowRuns: input.windowRuns ?? 1,
    }
  }

  return metadata as Prisma.InputJsonObject
}
