import "server-only"

import { JSONPath } from "jsonpath-plus"

import { normalizeAlertRuleMetadata, type AnomalyDirection } from "@/lib/alert-rule-metadata"
import { decryptSecret } from "@/lib/crypto"
import { notifyNewAlert } from "@/lib/notifications"
import { getPrisma } from "@/lib/prisma"

type JsonDocument = string | number | boolean | object | unknown[] | null

export type PollingResult = {
  checkedAt: string
  sampledNodes: number
  createdSamples: number
  evaluatedAlerts: number
  rollupsQueued: number
  deletedSamples: number
  status: string
  errorSummary?: string
}

function applyTransform(value: unknown, transform?: string | null) {
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) return null

  if (transform?.startsWith("divide:")) {
    const divisor = Number(transform.split(":")[1])
    return divisor ? numeric / divisor : numeric
  }

  if (transform?.startsWith("round:")) {
    const decimals = Number(transform.split(":")[1] ?? 0)
    const factor = 10 ** decimals
    return Math.round(numeric * factor) / factor
  }

  if (transform === "percent") {
    return numeric * 100
  }

  return numeric
}

function thresholdExceeded(value: number, threshold?: unknown) {
  const expression =
    typeof threshold === "string"
      ? threshold.trim()
      : threshold && typeof threshold === "object" && "expression" in threshold
        ? String((threshold as { expression?: string }).expression ?? "").trim()
        : ""
  const match = expression.match(/^(>=|>|<=|<|=)\s*(-?\d+(\.\d+)?)$/)
  if (!match) return false

  const target = Number(match[2])
  switch (match[1]) {
    case ">":
      return value > target
    case ">=":
      return value >= target
    case "<":
      return value < target
    case "<=":
      return value <= target
    case "=":
      return value === target
    default:
      return false
  }
}

function thresholdExpression(threshold?: unknown) {
  if (typeof threshold === "string") return threshold.trim()
  if (threshold && typeof threshold === "object" && "expression" in threshold) {
    return String((threshold as { expression?: unknown }).expression ?? "").trim()
  }
  return ""
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: number[], mean: number) {
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function anomalyExceeded(input: {
  value: number
  mean: number
  stdDev: number
  direction: AnomalyDirection
  sigma: number
}) {
  const highLimit = input.mean + input.sigma * input.stdDev
  const lowLimit = input.mean - input.sigma * input.stdDev
  const highBreach = input.value > highLimit
  const lowBreach = input.value < lowLimit

  return {
    breached:
      input.direction === "both" ? highBreach || lowBreach : input.direction === "low" ? lowBreach : highBreach,
    highLimit,
    lowLimit,
    breachedDirection: highBreach ? "high" : lowBreach ? "low" : null,
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2 }).format(value)
}

function bucketHour(date: Date) {
  const bucket = new Date(date)
  bucket.setMinutes(0, 0, 0)
  return bucket
}

async function createAlertIfNeeded(
  prisma: ReturnType<typeof getPrisma>,
  input: {
    nodeId: string
    title: string
    message: string
    severity: "INFO" | "WARNING" | "CRITICAL"
    ruleId?: string | null
  }
) {
  const existing = await prisma.alertEvent.findFirst({
    where: {
      nodeId: input.nodeId,
      title: input.title,
      resolvedAt: null,
    },
    select: { id: true },
  })

  if (existing) return false

  const alertEvent = await prisma.alertEvent.create({
    data: {
      title: input.title,
      message: input.message,
      severity: input.severity,
      nodeId: input.nodeId,
      ruleId: input.ruleId,
    },
  })
  await notifyNewAlert(prisma, {
    alertEventId: alertEvent.id,
    nodeId: input.nodeId,
    title: input.title,
    message: input.message,
    severity: input.severity,
  })
  return true
}

export async function runProjectPolling(options: { projectId?: string } = {}): Promise<PollingResult> {
  const prisma = getPrisma()
  const checkedAt = new Date()
  const execution = await prisma.pollExecution.create({
    data: {
      status: "RUNNING",
      startedAt: checkedAt,
    },
  })
  const nodes = await prisma.endpointNode.findMany({
    where: {
      endpointConfig: {
        isNot: null,
      },
      project: {
        archivedAt: null,
        ...(options.projectId ? { id: options.projectId } : {}),
      },
    },
    include: {
      endpointConfig: {
        include: {
          secret: true,
        },
      },
      mappings: true,
      project: {
        include: {
          alertRules: {
            where: { enabled: true },
          },
        },
      },
    },
  })

  let createdSamples = 0
  let evaluatedAlerts = 0
  let rollupsQueued = 0
  const errors: string[] = []

  const retentionCutoff = new Date(checkedAt.getTime() - 14 * 24 * 60 * 60 * 1000)
  const deletedSamples = (
    await prisma.metricSample.deleteMany({
      where: {
        sampledAt: {
          lt: retentionCutoff,
        },
      },
    })
  ).count

  for (const node of nodes) {
    const config = node.endpointConfig
    if (!config || !node.mappings.length) continue

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

    try {
      const headers = new Headers()
      if (config.secret) {
        const secret = decryptSecret(config.secret.encrypted)
        if (config.authType === "BEARER_TOKEN") headers.set("Authorization", `Bearer ${secret}`)
        if (config.authType === "API_KEY_HEADER") headers.set("X-API-Key", secret)
        if (config.authType === "BASIC") headers.set("Authorization", `Basic ${secret}`)
      }

      const response = await fetch(config.url, {
        method: config.method,
        headers,
        signal: controller.signal,
      })

      const responseText = await response.text()
      let json: JsonDocument
      try {
        json = responseText ? (JSON.parse(responseText) as JsonDocument) : {}
      } catch {
        json = { body: responseText }
      }

      const samples = []
      let degraded = !response.ok
      const breachReasons: string[] = []

      for (const mapping of node.mappings) {
        const extracted = JSONPath({ path: mapping.jsonPath, json, wrap: false })
        const value = applyTransform(extracted, mapping.transform)
        if (value === null) continue

        samples.push({
          value,
          rawJson: extracted === undefined ? undefined : extracted,
          sampledAt: checkedAt,
          nodeId: node.id,
          mappingId: mapping.id,
        })

        const matchingRules = node.project.alertRules.filter(
          (candidate) => candidate.nodeId === node.id && (candidate.mappingId === mapping.id || !candidate.mappingId)
        )

        if (matchingRules.length) {
          for (const rule of matchingRules) {
            const metadata = normalizeAlertRuleMetadata(rule.metadata)

            if (metadata.mode === "anomaly" && metadata.anomaly) {
              const cutoff = new Date(checkedAt.getTime() - metadata.anomaly.windowDays * 24 * 60 * 60 * 1000)
              const priorSamples = await prisma.metricSample.findMany({
                where: {
                  mappingId: mapping.id,
                  sampledAt: {
                    gte: cutoff,
                    lt: checkedAt,
                  },
                },
                orderBy: { sampledAt: "desc" },
                take: 1000,
                select: { value: true },
              })

              if (priorSamples.length < metadata.anomaly.minSamples) continue

              const values = priorSamples.map((sample) => sample.value)
              const mean = average(values)
              const stdDev = standardDeviation(values, mean)
              const anomaly = anomalyExceeded({
                value,
                mean,
                stdDev,
                direction: metadata.anomaly.direction,
                sigma: metadata.anomaly.sigma,
              })

              if (!anomaly.breached) continue

              degraded = true
              const direction = anomaly.breachedDirection ?? metadata.anomaly.direction
              const unit = mapping.unit ? ` ${mapping.unit}` : ""
              const title = rule.name
              const message = `${mapping.label} anomaly: ${formatNumber(value)}${unit} is a ${direction} outlier vs ${metadata.anomaly.windowDays}d baseline mean ${formatNumber(mean)}${unit}, std dev ${formatNumber(stdDev)}${unit}, ${metadata.anomaly.sigma}σ.`
              breachReasons.push(`Anomaly breach: ${mapping.label} ${direction} outlier`)
              if (await createAlertIfNeeded(prisma, { nodeId: node.id, title, message, severity: rule.severity, ruleId: rule.id })) {
                evaluatedAlerts += 1
              }
              continue
            }

            if (thresholdExceeded(value, rule.expression)) {
              degraded = true
              const title = rule.name
              const message = `${mapping.label} is ${value}${mapping.unit ? ` ${mapping.unit}` : ""} (${thresholdExpression(rule.expression)}).`
              breachReasons.push(`Threshold breach: ${mapping.label} ${thresholdExpression(rule.expression)}`)
              if (await createAlertIfNeeded(prisma, { nodeId: node.id, title, message, severity: rule.severity, ruleId: rule.id })) {
                evaluatedAlerts += 1
              }
            }
          }
        } else if (thresholdExceeded(value, mapping.threshold)) {
          degraded = true
          const title = `${mapping.label} threshold crossed`
          const message = `${mapping.label} is ${value}${mapping.unit ? ` ${mapping.unit}` : ""} (${thresholdExpression(mapping.threshold)}).`
          breachReasons.push(`Threshold breach: ${mapping.label} ${thresholdExpression(mapping.threshold)}`)
          if (await createAlertIfNeeded(prisma, { nodeId: node.id, title, message, severity: "WARNING", ruleId: null })) {
            evaluatedAlerts += 1
          }
        }
      }

      if (samples.length) {
        await prisma.metricSample.createMany({ data: samples })
        createdSamples += samples.length
      }

      await prisma.endpointNode.update({
        where: { id: node.id },
        data: {
          status: response.ok ? (degraded ? "DEGRADED" : "ACTIVE") : "DOWN",
          statusReason: response.ok
            ? breachReasons.length
              ? `${breachReasons.slice(0, 2).join(" | ")} at ${checkedAt.toISOString()}.`
              : `Last poll completed at ${checkedAt.toISOString()}.`
            : `HTTP ${response.status} from endpoint.`,
        },
      })

      const hour = bucketHour(checkedAt)
      for (const mapping of node.mappings) {
        const aggregate = await prisma.metricSample.aggregate({
          where: {
            mappingId: mapping.id,
            sampledAt: {
              gte: hour,
              lt: new Date(hour.getTime() + 60 * 60 * 1000),
            },
          },
          _avg: { value: true },
        })

        if (aggregate._avg.value !== null) {
          await prisma.metricRollup.upsert({
            where: {
              scope_metricKey_bucket_startedAt: {
                scope: node.id,
                metricKey: mapping.label,
                bucket: "hour",
                startedAt: hour,
              },
            },
            update: {
              value: aggregate._avg.value,
              endedAt: new Date(hour.getTime() + 60 * 60 * 1000),
            },
            create: {
              scope: node.id,
              metricKey: mapping.label,
              bucket: "hour",
              value: aggregate._avg.value,
              startedAt: hour,
              endedAt: new Date(hour.getTime() + 60 * 60 * 1000),
            },
          })
          rollupsQueued += 1
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Endpoint polling failed."
      errors.push(`${node.label}: ${message}`)
      await prisma.endpointNode.update({
        where: { id: node.id },
        data: {
          status: "DOWN",
          statusReason: message,
        },
      })
      const existing = await prisma.alertEvent.findFirst({
        where: {
          nodeId: node.id,
          title: "Endpoint polling failed",
          resolvedAt: null,
        },
        select: { id: true },
      })

      if (!existing) {
        if (
          await createAlertIfNeeded(prisma, {
            nodeId: node.id,
            title: "Endpoint polling failed",
            message,
            severity: "CRITICAL",
          })
        ) {
          evaluatedAlerts += 1
        }
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  const finishedAt = new Date()
  const status = errors.length ? "PARTIAL" : "SUCCESS"
  const errorSummary = errors.length ? errors.slice(0, 5).join(" | ") : undefined

  await prisma.pollExecution.update({
    where: { id: execution.id },
    data: {
      status,
      finishedAt,
      durationMs: finishedAt.getTime() - checkedAt.getTime(),
      sampledNodes: nodes.length,
      createdSamples,
      evaluatedAlerts,
      rollupsQueued,
      deletedSamples,
      errorSummary,
    },
  })

  return {
    checkedAt: checkedAt.toISOString(),
    sampledNodes: nodes.length,
    createdSamples,
    evaluatedAlerts,
    rollupsQueued,
    deletedSamples,
    status,
    errorSummary,
  }
}

export function isCronAuthorized(request: Request) {
  const configuredSecret = process.env.CRON_SECRET
  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production"
  }

  const authHeader = request.headers.get("authorization")
  if (authHeader === `Bearer ${configuredSecret}`) return true
  if (!authHeader?.startsWith("Basic ")) return false

  try {
    const credentials = Buffer.from(authHeader.slice("Basic ".length), "base64").toString("utf8")
    const separatorIndex = credentials.indexOf(":")
    if (separatorIndex === -1) return false

    const username = credentials.slice(0, separatorIndex)
    const password = credentials.slice(separatorIndex + 1)
    return username === "argusgrid-cron" && password === configuredSecret
  } catch {
    return false
  }
}
