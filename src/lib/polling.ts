import "server-only"

import { JSONPath } from "jsonpath-plus"

import { decryptSecret } from "@/lib/crypto"
import { getPrisma } from "@/lib/prisma"

export type PollingResult = {
  checkedAt: string
  sampledNodes: number
  createdSamples: number
  evaluatedAlerts: number
  rollupsQueued: number
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
  if (!threshold || typeof threshold !== "object" || !("expression" in threshold)) return false
  const expression = String((threshold as { expression?: string }).expression ?? "").trim()
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

function bucketHour(date: Date) {
  const bucket = new Date(date)
  bucket.setMinutes(0, 0, 0)
  return bucket
}

export async function runProjectPolling(): Promise<PollingResult> {
  const prisma = getPrisma()
  const checkedAt = new Date()
  const nodes = await prisma.endpointNode.findMany({
    where: {
      endpointConfig: {
        isNot: null,
      },
      project: {
        archivedAt: null,
      },
    },
    include: {
      endpointConfig: {
        include: {
          secret: true,
        },
      },
      mappings: true,
    },
  })

  let createdSamples = 0
  let evaluatedAlerts = 0
  let rollupsQueued = 0

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

      const json = await response.json()
      const samples = []
      let degraded = !response.ok

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

        if (thresholdExceeded(value, mapping.threshold)) {
          degraded = true
          evaluatedAlerts += 1
          await prisma.alertEvent.create({
            data: {
              title: `${mapping.label} threshold crossed`,
              message: `${mapping.label} is ${value}${mapping.unit ? ` ${mapping.unit}` : ""}`,
              severity: "WARNING",
              nodeId: node.id,
            },
          })
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
          statusReason: response.ok ? `Last poll completed at ${checkedAt.toISOString()}.` : `HTTP ${response.status} from endpoint.`,
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
      evaluatedAlerts += 1
      await prisma.endpointNode.update({
        where: { id: node.id },
        data: {
          status: "DOWN",
          statusReason: error instanceof Error ? error.message : "Endpoint polling failed.",
        },
      })
      await prisma.alertEvent.create({
        data: {
          title: "Endpoint polling failed",
          message: error instanceof Error ? error.message : "Endpoint polling failed.",
          severity: "CRITICAL",
          nodeId: node.id,
        },
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    checkedAt: checkedAt.toISOString(),
    sampledNodes: nodes.length,
    createdSamples,
    evaluatedAlerts,
    rollupsQueued,
  }
}

export function isCronAuthorized(request: Request) {
  const configuredSecret = process.env.CRON_SECRET
  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production"
  }

  const authHeader = request.headers.get("authorization")
  return authHeader === `Bearer ${configuredSecret}`
}
