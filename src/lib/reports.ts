import "server-only"

import { randomBytes } from "node:crypto"

import { getPrisma } from "@/lib/prisma"

export type ReportSharePayload = {
  id: string
  title: string
  clientName: string | null
  url: string
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

export type PublicReportPayload = {
  title: string
  clientName: string | null
  organizationName: string
  projectName: string
  generatedAt: string
  summary: {
    uptimePercent: number
    totalRuns: number
    successRate: number
    totalCostUsd: number
    totalTokens: number
    activeAlerts: number
    qualityScore: number
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

export function serializeReportShare(share: {
  id: string
  token: string
  title: string
  clientName: string | null
  expiresAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}, origin: string): ReportSharePayload {
  return {
    id: share.id,
    title: share.title,
    clientName: share.clientName,
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
  const allAlertEvents = share.project.alertRules.flatMap((rule) => rule.events)
  const activeAlerts = allAlertEvents.filter((event) => !event.resolvedAt).length
  const successRate = pct(successfulRuns, totalRuns)
  const uptimePercent = pct(activeNodes, share.project.nodes.length)

  return {
    title: share.title,
    clientName: share.clientName,
    organizationName: share.project.organization.name,
    projectName: share.project.name,
    generatedAt: new Date().toISOString(),
    summary: {
      uptimePercent,
      totalRuns,
      successRate,
      totalCostUsd,
      totalTokens,
      activeAlerts,
      qualityScore: Math.round((successRate + uptimePercent) / 2),
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
