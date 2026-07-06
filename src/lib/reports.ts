import "server-only"

import { randomBytes } from "node:crypto"

import { getPrisma } from "@/lib/prisma"

export type ReportSharePayload = {
  id: string
  title: string
  clientName: string | null
  subtitle: string | null
  preparedBy: string | null
  executiveNote: string | null
  hasMapImage: boolean
  hasBrandImage: boolean
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
    resolvedAt: string | null
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

export async function getPublicReport(token: string): Promise<PublicReportPayload | null> {
  const prisma = getPrisma()
  const share = await prisma.reportShare.findUnique({
    where: { token },
    include: {
      project: {
        include: {
          organization: true,
          nodes: {
            include: {
              runs: {
                orderBy: { startedAt: "desc" },
                take: 200,
              },
              samples: {
                orderBy: { sampledAt: "desc" },
                take: 20,
              },
              alertEvents: {
                orderBy: { createdAt: "desc" },
                take: 20,
              },
            },
            orderBy: { createdAt: "asc" },
          },
          alertRules: {
            include: {
              events: {
                orderBy: { createdAt: "desc" },
                take: 40,
                include: {
                  node: {
                    select: { label: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!share || share.revokedAt) return null
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null

  const nodes = share.project.nodes.map((node) => {
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
  const successfulRuns = share.project.nodes.flatMap((node) => node.runs).filter((run) => run.status.toLowerCase() === "success").length
  const activeNodes = share.project.nodes.filter((node) => node.status === "ACTIVE").length
  const degradedNodes = share.project.nodes.filter((node) => node.status === "DEGRADED").length
  const downNodes = share.project.nodes.filter((node) => node.status === "DOWN").length
  const allAlertEvents = share.project.alertRules.flatMap((rule) => rule.events)
  const activeAlerts = allAlertEvents.filter((event) => !event.resolvedAt).length
  const successRate = pct(successfulRuns, totalRuns)
  const uptimePercent = pct(activeNodes, share.project.nodes.length)
  const latestSampleAt = nodes
    .map((node) => node.latestSampleAt ? new Date(node.latestSampleAt).getTime() : 0)
    .filter(Boolean)
    .sort((a, b) => b - a)[0]

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
    nodes,
    alerts: allAlertEvents
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 12)
      .map((event) => ({
        id: event.id,
        title: event.title,
        severity: event.severity,
        nodeLabel: event.node?.label ?? null,
        createdAt: event.createdAt.toISOString(),
        resolvedAt: event.resolvedAt?.toISOString() ?? null,
      })),
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
