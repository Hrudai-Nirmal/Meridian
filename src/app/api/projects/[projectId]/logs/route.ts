/**
 * Normalized project activity timeline API for the operational Logs section.
 */
import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { sanitizeAuditMetadata } from "@/lib/audit-log"
import { getPrisma } from "@/lib/prisma"

const LOG_TYPES = ["activity", "alerts", "polling", "deliveries", "runs", "reports", "webhooks", "team", "map"] as const
const WINDOW_OPTIONS = ["24h", "7d", "30d", "all"] as const

const logsQuerySchema = z.object({
  type: z.enum(LOG_TYPES).optional(),
  window: z.enum(WINDOW_OPTIONS).default("7d"),
  q: z.string().max(120).optional(),
})

type LogType = (typeof LOG_TYPES)[number]

type ProjectLogItem = {
  id: string
  type: LogType
  title: string
  message: string
  status: string
  entity: string
  entityId: string | null
  nodeLabel?: string | null
  actor?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
}

function getWindowStart(window: (typeof WINDOW_OPTIONS)[number]) {
  if (window === "all") return undefined
  const now = Date.now()
  const days = window === "24h" ? 1 : window === "7d" ? 7 : 30
  return new Date(now - days * 24 * 60 * 60 * 1000)
}

function getAuditType(entity: string, action: string): LogType {
  if (entity === "alert") return "alerts"
  if (entity === "webhook") return "webhooks"
  if (entity === "report") return "reports"
  if (entity === "token") return "activity"
  if (entity === "team") return "team"
  if (entity === "graph" || action.startsWith("graph.")) return "map"
  if (entity === "poll") return "polling"
  return "activity"
}

function getStatusFromText(value: string | null | undefined) {
  if (!value) return "info"
  const normalized = value.toLowerCase()
  if (normalized.includes("fail") || normalized.includes("error") || normalized.includes("down")) return "failed"
  if (normalized.includes("resolve") || normalized.includes("success") || normalized.includes("sent")) return "success"
  return normalized
}

function getActor(metadata: Record<string, unknown> | null) {
  const actor = metadata?.actor
  if (!actor || typeof actor !== "object" || Array.isArray(actor)) return null
  const actorRecord = actor as Record<string, unknown>
  const name = typeof actorRecord.name === "string" ? actorRecord.name : null
  const email = typeof actorRecord.email === "string" ? actorRecord.email : null
  return name ?? email
}

function getHost(url: string) {
  try {
    return new URL(url).host
  } catch {
    return "configured endpoint"
  }
}

function matchesQuery(item: ProjectLogItem, query: string | undefined) {
  if (!query) return true
  const needle = query.toLowerCase()
  return [item.title, item.message, item.entity, item.entityId, item.nodeLabel, item.actor, JSON.stringify(item.metadata ?? {})]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle))
}

/**
 * Returns a secret-safe, normalized project timeline composed from existing operational tables.
 */
export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN", "MEMBER", "VIEWER"])
  if (accessError) return accessError

  const parsed = logsQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid logs query.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, organizationId: true },
  })
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 })
  }

  const createdAtFilter = getWindowStart(parsed.data.window)
  const createdAtWhere = createdAtFilter ? { gte: createdAtFilter } : undefined
  const [auditLogs, alertEvents, deliveries, pollExecutions, workflowRuns, reportShares, webhooks, tokens, graphEdges] =
    await Promise.all([
      prisma.auditLog.findMany({
        where: {
          organizationId: project.organizationId,
          ...(createdAtWhere ? { createdAt: createdAtWhere } : {}),
          OR: [{ projectId }, { projectId: null }],
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.alertEvent.findMany({
        where: {
          ...(createdAtWhere ? { createdAt: createdAtWhere } : {}),
          OR: [{ node: { projectId } }, { rule: { projectId } }],
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { node: { select: { label: true } }, rule: { select: { name: true } } },
      }),
      prisma.alertNotificationDelivery.findMany({
        where: {
          ...(createdAtWhere ? { attemptedAt: createdAtWhere } : {}),
          alertEvent: {
            OR: [{ node: { projectId } }, { rule: { projectId } }],
          },
        },
        orderBy: { attemptedAt: "desc" },
        take: 100,
        include: { alertEvent: { include: { node: { select: { label: true } } } } },
      }),
      prisma.pollExecution.findMany({
        where: createdAtWhere ? { startedAt: createdAtWhere } : undefined,
        orderBy: { startedAt: "desc" },
        take: 100,
      }),
      prisma.workflowRun.findMany({
        where: {
          ...(createdAtWhere ? { startedAt: createdAtWhere } : {}),
          node: { projectId },
        },
        orderBy: { startedAt: "desc" },
        take: 100,
        include: { node: { select: { label: true } } },
      }),
      prisma.reportShare.findMany({
        where: { projectId, ...(createdAtWhere ? { createdAt: createdAtWhere } : {}) },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.projectWebhookDestination.findMany({
        where: { projectId, ...(createdAtWhere ? { createdAt: createdAtWhere } : {}) },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.ingestionToken.findMany({
        where: { projectId, ...(createdAtWhere ? { createdAt: createdAtWhere } : {}) },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, name: true, prefix: true, revokedAt: true, createdAt: true, lastUsedAt: true },
      }),
      prisma.graphEdge.findMany({
        where: { projectId, ...(createdAtWhere ? { createdAt: createdAtWhere } : {}) },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ])

  const items: ProjectLogItem[] = [
    ...auditLogs.map((auditLog) => {
      const metadata = sanitizeAuditMetadata(auditLog.metadata)
      return {
        id: `audit-${auditLog.id}`,
        type: getAuditType(auditLog.entity, auditLog.action),
        title: auditLog.action,
        message: `${auditLog.entity} ${auditLog.action.replace(".", " ")}`,
        status: getStatusFromText(auditLog.action),
        entity: auditLog.entity,
        entityId: auditLog.entityId,
        actor: getActor(metadata),
        metadata,
        createdAt: auditLog.createdAt.toISOString(),
      }
    }),
    ...alertEvents.map((event) => ({
      id: `alert-${event.id}`,
      type: "alerts" as const,
      title: event.title,
      message: event.message,
      status: event.resolvedAt ? "resolved" : event.severity.toLowerCase(),
      entity: "alert",
      entityId: event.id,
      nodeLabel: event.node?.label ?? null,
      metadata: { severity: event.severity, rule: event.rule?.name ?? null, resolvedAt: event.resolvedAt?.toISOString() ?? null },
      createdAt: event.createdAt.toISOString(),
    })),
    ...deliveries.map((delivery) => ({
      id: `delivery-${delivery.id}`,
      type: "deliveries" as const,
      title: `${delivery.channel} delivery ${delivery.status}`,
      message: delivery.failureReason ?? `Delivery to ${delivery.recipient} via ${delivery.provider}`,
      status: delivery.status,
      entity: "delivery",
      entityId: delivery.id,
      nodeLabel: delivery.alertEvent?.node?.label ?? null,
      metadata: { channel: delivery.channel, provider: delivery.provider, recipient: delivery.recipient, sentAt: delivery.sentAt?.toISOString() ?? null },
      createdAt: delivery.attemptedAt.toISOString(),
    })),
    ...pollExecutions.map((poll) => ({
      id: `poll-${poll.id}`,
      type: "polling" as const,
      title: `Poll ${poll.status}`,
      message: poll.errorSummary ?? `${poll.sampledNodes} nodes sampled, ${poll.createdSamples} samples created.`,
      status: poll.status,
      entity: "poll",
      entityId: poll.id,
      metadata: {
        durationMs: poll.durationMs,
        sampledNodes: poll.sampledNodes,
        createdSamples: poll.createdSamples,
        evaluatedAlerts: poll.evaluatedAlerts,
      },
      createdAt: poll.startedAt.toISOString(),
    })),
    ...workflowRuns.map((run) => ({
      id: `run-${run.id}`,
      type: "runs" as const,
      title: `Run ${run.status}`,
      message: run.externalId ? `External run ${run.externalId}` : "Workflow run ingested",
      status: run.status,
      entity: "run",
      entityId: run.id,
      nodeLabel: run.node.label,
      metadata: { finishedAt: run.finishedAt?.toISOString() ?? null, tokens: run.tokens, costUsd: run.costUsd?.toString() ?? null },
      createdAt: run.startedAt.toISOString(),
    })),
    ...reportShares.map((share) => ({
      id: `report-${share.id}`,
      type: "reports" as const,
      title: share.revokedAt ? "Report revoked" : "Report link created",
      message: share.title,
      status: share.revokedAt ? "revoked" : "active",
      entity: "report",
      entityId: share.id,
      metadata: { clientName: share.clientName, expiresAt: share.expiresAt?.toISOString() ?? null },
      createdAt: share.createdAt.toISOString(),
    })),
    ...webhooks.map((webhook) => ({
      id: `webhook-${webhook.id}`,
      type: "webhooks" as const,
      title: webhook.enabled ? "Webhook destination enabled" : "Webhook destination disabled",
      message: webhook.name,
      status: webhook.enabled ? "enabled" : "disabled",
      entity: "webhook",
      entityId: webhook.id,
      metadata: { host: getHost(webhook.url), eventFilters: webhook.eventFilters },
      createdAt: webhook.createdAt.toISOString(),
    })),
    ...tokens.map((token) => ({
      id: `token-${token.id}`,
      type: "activity" as const,
      title: token.revokedAt ? "Telemetry token revoked" : "Telemetry token created",
      message: token.name,
      status: token.revokedAt ? "revoked" : "active",
      entity: "token",
      entityId: token.id,
      metadata: { prefix: token.prefix, lastUsedAt: token.lastUsedAt?.toISOString() ?? null },
      createdAt: token.createdAt.toISOString(),
    })),
    ...graphEdges.map((edge) => ({
      id: `edge-${edge.id}`,
      type: "map" as const,
      title: "Map connection saved",
      message: edge.label ?? "visual link",
      status: "active",
      entity: "graph",
      entityId: edge.id,
      metadata: { sourceId: edge.sourceId, targetId: edge.targetId },
      createdAt: edge.createdAt.toISOString(),
    })),
  ]

  const filteredItems = items
    .filter((item) => !parsed.data.type || item.type === parsed.data.type)
    .filter((item) => matchesQuery(item, parsed.data.q))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 250)

  return NextResponse.json({
    project: { id: project.id, name: project.name },
    filters: parsed.data,
    logs: filteredItems,
  })
}
