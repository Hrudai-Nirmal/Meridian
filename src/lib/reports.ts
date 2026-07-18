import "server-only"

import { randomBytes } from "node:crypto"

import { getPrisma } from "@/lib/prisma"
import { formatReportPeriodLabel, resolveReportPeriod } from "@/lib/report-periods.mjs"

type ResolvedReportPeriod = ReturnType<typeof resolveReportPeriod>

export type ReportSharePayload = {
  id: string
  title: string
  clientName: string | null
  subtitle: string | null
  preparedBy: string | null
  executiveNote: string | null
  hasMapImage: boolean
  hasBrandImage: boolean
  periodMode: string
  periodWindow: string | null
  periodStart: string | null
  periodEnd: string | null
  comparisonEnabled: boolean
  presetId: string | null
  url: string
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

export type PublicReportPayload = {
  title: string
  clientName: string | null
  subtitle: string | null
  preparedBy: string | null
  executiveNote: string | null
  organizationName: string
  projectName: string
  generatedAt: string
  mapImageUrl: string | null
  brandImageUrl: string | null
  period: {
    mode: string
    window: string | null
    start: string | null
    end: string | null
    label: string
    comparisonEnabled: boolean
  }
  summary: {
    uptimePercent: number
    totalRuns: number
    successRate: number
    totalCostUsd: number
    totalTokens: number
    activeAlerts: number
    qualityScore: number
    latestSampleAt: string | null
    degradedNodes: number
    downNodes: number
  }
  comparison: {
    label: string
    summary: {
      totalRuns: number
      successRate: number
      totalCostUsd: number
      totalTokens: number
      activeAlerts: number
      qualityScore: number
    }
  } | null
  nodes: {
    id: string
    label: string
    status: string
    category: string
    runCount: number
    successRate: number
    costUsd: number
    tokens: number
    latestRunAt: string | null
    latestSampleAt: string | null
  }[]
  alerts: {
    id: string
    title: string
    severity: string
    nodeLabel: string | null
    createdAt: string
    lastSeenAt: string
    occurrenceCount: number
    resolvedAt: string | null
    status: "active" | "resolved"
    message: string
  }[]
  incidentTimeline: {
    id: string
    title: string
    severity: string
    nodeLabel: string | null
    message: string
    createdAt: string
    lastSeenAt: string
    occurrenceCount: number
    resolvedAt: string | null
    status: "active" | "resolved"
  }[]
}

export function createReportToken() {
  return `agr_${randomBytes(24).toString("base64url")}`
}

export function reportShareUrl(origin: string, token: string) {
  return `${origin.replace(/\/$/, "")}/reports/${token}`
}

export function reportMapImageUrl(origin: string, token: string) {
  return `${reportShareUrl(origin, token)}/map.png`
}

export function reportBrandImageUrl(origin: string, token: string) {
  return `${reportShareUrl(origin, token)}/brand-image`
}

export function serializeReportShare(share: {
  id: string
  token: string
  title: string
  clientName: string | null
  subtitle: string | null
  preparedBy: string | null
  executiveNote: string | null
  mapImageMimeType: string | null
  brandImageMimeType: string | null
  periodMode: string
  periodWindow: string | null
  periodStart: Date | null
  periodEnd: Date | null
  comparisonEnabled: boolean
  presetId: string | null
  expiresAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}, origin: string): ReportSharePayload {
  return {
    id: share.id,
    title: share.title,
    clientName: share.clientName,
    subtitle: share.subtitle,
    preparedBy: share.preparedBy,
    executiveNote: share.executiveNote,
    hasMapImage: Boolean(share.mapImageMimeType),
    hasBrandImage: Boolean(share.brandImageMimeType),
    periodMode: share.periodMode,
    periodWindow: share.periodWindow,
    periodStart: share.periodStart?.toISOString() ?? null,
    periodEnd: share.periodEnd?.toISOString() ?? null,
    comparisonEnabled: share.comparisonEnabled,
    presetId: share.presetId,
    url: reportShareUrl(origin, share.token),
    expiresAt: share.expiresAt?.toISOString() ?? null,
    revokedAt: share.revokedAt?.toISOString() ?? null,
    createdAt: share.createdAt.toISOString(),
  }
}

function decimalToNumber(value: { toString(): string } | null) {
  return value ? Number(value.toString()) : 0
}

function pct(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

function rangeWhere(period: ResolvedReportPeriod, field: "startedAt" | "sampledAt" | "createdAt") {
  if (!period.start || !period.end) return undefined
  return {
    [field]: {
      gte: period.start,
      lte: period.end,
    },
  }
}

function summarizeRuns(input: {
  runs: { status: string; costUsd: { toString(): string } | null; tokens: number | null }[]
  activeNodes: number
  nodeCount: number
  activeAlerts: number
}) {
  const totalRuns = input.runs.length
  const successfulRuns = input.runs.filter((run) => run.status.toLowerCase() === "success").length
  const successRate = pct(successfulRuns, totalRuns)
  const uptimePercent = pct(input.activeNodes, input.nodeCount)
  return {
    uptimePercent,
    totalRuns,
    successRate,
    totalCostUsd: input.runs.reduce((sum, run) => sum + decimalToNumber(run.costUsd), 0),
    totalTokens: input.runs.reduce((sum, run) => sum + (run.tokens ?? 0), 0),
    activeAlerts: input.activeAlerts,
    qualityScore: Math.round((successRate + uptimePercent) / 2),
  }
}

export async function getPublicReport(token: string): Promise<PublicReportPayload | null> {
  const prisma = getPrisma()
  const share = await prisma.reportShare.findUnique({
    where: { token },
    include: {
      project: {
        include: {
          organization: true,
        },
      },
    },
  })

  if (!share || share.revokedAt) return null
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null

  const period = resolveReportPeriod({
    mode: share.periodMode,
    window: share.periodWindow,
    start: share.periodStart,
    end: share.periodEnd,
    comparisonEnabled: share.comparisonEnabled,
  })
  const currentRunWhere = rangeWhere(period, "startedAt")
  const currentSampleWhere = rangeWhere(period, "sampledAt")
  const currentAlertWhere = rangeWhere(period, "createdAt")
  const nodesWithPeriodData = await prisma.endpointNode.findMany({
    where: { projectId: share.projectId },
    include: {
      runs: {
        where: currentRunWhere,
        orderBy: { startedAt: "desc" },
        take: 1000,
      },
      samples: {
        where: currentSampleWhere,
        orderBy: { sampledAt: "desc" },
        take: 100,
      },
      alertEvents: {
        where: currentAlertWhere,
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
    orderBy: { createdAt: "asc" },
  })

  const nodes = nodesWithPeriodData.map((node) => {
    const totalRuns = node.runs.length
    const successfulRuns = node.runs.filter((run) => run.status.toLowerCase() === "success").length
    const costUsd = node.runs.reduce((sum, run) => sum + decimalToNumber(run.costUsd), 0)
    const tokens = node.runs.reduce((sum, run) => sum + (run.tokens ?? 0), 0)
    const latestRun = node.runs[0]
    const latestSample = node.samples[0]

    return {
      id: node.id,
      label: node.label,
      status: node.status,
      category: node.category,
      runCount: totalRuns,
      successRate: pct(successfulRuns, totalRuns),
      costUsd,
      tokens,
      latestRunAt: latestRun?.startedAt.toISOString() ?? null,
      latestSampleAt: latestSample?.sampledAt.toISOString() ?? null,
    }
  })
  const totalRuns = nodes.reduce((sum, node) => sum + node.runCount, 0)
  const totalCostUsd = nodes.reduce((sum, node) => sum + node.costUsd, 0)
  const totalTokens = nodes.reduce((sum, node) => sum + node.tokens, 0)
  const currentRuns = nodesWithPeriodData.flatMap((node) => node.runs)
  const successfulRuns = currentRuns.filter((run) => run.status.toLowerCase() === "success").length
  const activeNodes = nodesWithPeriodData.filter((node) => node.status === "ACTIVE").length
  const degradedNodes = nodesWithPeriodData.filter((node) => node.status === "DEGRADED").length
  const downNodes = nodesWithPeriodData.filter((node) => node.status === "DOWN").length
  const allAlertEvents = nodesWithPeriodData.flatMap((node) =>
    node.alertEvents.map((event) => ({
      ...event,
      node: { label: node.label },
    }))
  )
  const activeAlerts = allAlertEvents.filter((event) => !event.resolvedAt).length
  const successRate = pct(successfulRuns, totalRuns)
  const uptimePercent = pct(activeNodes, nodesWithPeriodData.length)
  const latestSampleAt = nodes
    .map((node) => node.latestSampleAt ? new Date(node.latestSampleAt).getTime() : 0)
    .filter(Boolean)
    .sort((a, b) => b - a)[0]
  const previousRuns = period.previous
    ? await prisma.workflowRun.findMany({
        where: {
          node: { projectId: share.projectId },
          startedAt: {
            gte: period.previous.start,
            lte: period.previous.end,
          },
        },
        select: {
          status: true,
          costUsd: true,
          tokens: true,
        },
      })
    : []
  const previousAlerts = period.previous
    ? await prisma.alertEvent.findMany({
        where: {
          node: { projectId: share.projectId },
          createdAt: {
            gte: period.previous.start,
            lte: period.previous.end,
          },
          resolvedAt: null,
        },
        select: { id: true },
      })
    : []
  const previousSummary = period.previous
    ? summarizeRuns({
        runs: previousRuns,
        activeNodes,
        nodeCount: nodesWithPeriodData.length,
        activeAlerts: previousAlerts.length,
      })
    : null
  const incidentTimeline = allAlertEvents
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 20)
    .map((event) => ({
      id: event.id,
      title: event.title,
      severity: event.severity,
      nodeLabel: event.node?.label ?? null,
      message: event.message,
      createdAt: event.createdAt.toISOString(),
      lastSeenAt: event.lastSeenAt.toISOString(),
      occurrenceCount: event.occurrenceCount,
      resolvedAt: event.resolvedAt?.toISOString() ?? null,
      status: event.resolvedAt ? "resolved" as const : "active" as const,
    }))

  return {
    title: share.title,
    clientName: share.clientName,
    subtitle: share.subtitle,
    preparedBy: share.preparedBy,
    executiveNote: share.executiveNote,
    organizationName: share.project.organization.name,
    projectName: share.project.name,
    generatedAt: new Date().toISOString(),
    mapImageUrl: share.mapImageMimeType ? reportMapImageUrl("", share.token) : null,
    brandImageUrl: share.brandImageMimeType ? reportBrandImageUrl("", share.token) : null,
    period: {
      mode: period.mode,
      window: period.window ?? null,
      start: period.start?.toISOString() ?? null,
      end: period.end?.toISOString() ?? null,
      label: formatReportPeriodLabel(period),
      comparisonEnabled: period.comparisonEnabled,
    },
    summary: {
      uptimePercent,
      totalRuns,
      successRate,
      totalCostUsd,
      totalTokens,
      activeAlerts,
      qualityScore: Math.round((successRate + uptimePercent) / 2),
      latestSampleAt: latestSampleAt ? new Date(latestSampleAt).toISOString() : null,
      degradedNodes,
      downNodes,
    },
    comparison: previousSummary
      ? {
          label: `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(period.previous!.start)} - ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(period.previous!.end)}`,
          summary: {
            totalRuns: previousSummary.totalRuns,
            successRate: previousSummary.successRate,
            totalCostUsd: previousSummary.totalCostUsd,
            totalTokens: previousSummary.totalTokens,
            activeAlerts: previousSummary.activeAlerts,
            qualityScore: previousSummary.qualityScore,
          },
        }
      : null,
    nodes,
    alerts: incidentTimeline.slice(0, 12),
    incidentTimeline,
  }
}

export async function getPublicReportMapImage(token: string) {
  const prisma = getPrisma()
  const share = await prisma.reportShare.findUnique({
    where: { token },
    select: {
      revokedAt: true,
      expiresAt: true,
      mapImageMimeType: true,
      mapImageData: true,
    },
  })

  if (!share || share.revokedAt) return null
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null
  if (share.mapImageMimeType !== "image/png" || !share.mapImageData) return null

  return {
    mimeType: share.mapImageMimeType,
    data: share.mapImageData,
  }
}

export async function getPublicReportBrandImage(token: string) {
  const prisma = getPrisma()
  const share = await prisma.reportShare.findUnique({
    where: { token },
    select: {
      revokedAt: true,
      expiresAt: true,
      brandImageMimeType: true,
      brandImageData: true,
    },
  })

  if (!share || share.revokedAt) return null
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null
  if (!share.brandImageMimeType || !share.brandImageData) return null
  if (!["image/png", "image/svg+xml"].includes(share.brandImageMimeType)) return null

  return {
    mimeType: share.brandImageMimeType,
    data: share.brandImageData,
  }
}
