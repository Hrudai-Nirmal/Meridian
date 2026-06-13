import type { Prisma } from "@prisma/client"

export type AlertRuleMode = "threshold" | "anomaly"
export type AnomalyDirection = "high" | "low" | "both"

export const anomalyDefaults = {
  direction: "high" as AnomalyDirection,
  sigma: 2,
  windowDays: 7,
  minSamples: 8,
}

export type NormalizedAlertRuleMetadata = {
  mode: AlertRuleMode
  nodeLabel: string | null
  mappingLabel: string | null
  anomaly: {
    direction: AnomalyDirection
    sigma: number
    windowDays: number
    minSamples: number
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

export function normalizeAlertRuleMetadata(metadata: unknown): NormalizedAlertRuleMetadata {
  const record = metadataRecord(metadata)
  const anomalyRecord = metadataRecord(record.anomaly)
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

  return {
    mode,
    nodeLabel: typeof record.nodeLabel === "string" ? record.nodeLabel : null,
    mappingLabel: typeof record.mappingLabel === "string" ? record.mappingLabel : null,
    anomaly,
  }
}

export function buildAlertRuleMetadata(input: {
  mode?: AlertRuleMode
  nodeLabel?: string | null
  mappingLabel?: string | null
  anomalyDirection?: AnomalyDirection
  sigma?: number
  windowDays?: number
  minSamples?: number
}): Prisma.InputJsonObject {
  const mode = input.mode ?? "threshold"
  const metadata: Record<string, Prisma.InputJsonValue | null> = {
    mode,
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

  return metadata as Prisma.InputJsonObject
}
