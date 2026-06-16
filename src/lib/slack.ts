/**
 * Native Slack incoming-webhook delivery for project alert incidents.
 */
import "server-only"

import { randomUUID } from "crypto"
import type { AlertSeverity, PrismaClient, ProjectSlackDestination } from "@prisma/client"

import { decryptSecret, encryptSecret } from "@/lib/crypto"

export type SlackAlertEventType = "alert.opened" | "alert.resolved" | "slack.test"

type SlackAlertPayload = {
  event: SlackAlertEventType
  deliveryId: string
  createdAt: string
  project: {
    id: string
    name: string
    slug: string
  }
  node: {
    id: string
    label: string
  } | null
  rule: {
    id: string
    name: string
  } | null
  source: string
  alert: {
    id: string
    title: string
    message: string
    severity: AlertSeverity
    status: "open" | "resolved" | "test"
    createdAt: string
    resolvedAt: string | null
  }
}

type DeliverSlackInput = {
  eventType: SlackAlertEventType
  alertEventId?: string
  projectId?: string
  destinationId?: string
}

const SLACK_EVENTS: SlackAlertEventType[] = ["alert.opened", "alert.resolved", "slack.test"]

const severityRank: Record<AlertSeverity, number> = {
  INFO: 0,
  WARNING: 1,
  CRITICAL: 2,
}

function waitForRetry() {
  return new Promise((resolve) => setTimeout(resolve, 500))
}

function normalizeSlackEvents(value: unknown) {
  if (!Array.isArray(value)) return SLACK_EVENTS
  const events = value.filter((event): event is SlackAlertEventType => SLACK_EVENTS.includes(event as SlackAlertEventType))
  return events.length ? events : SLACK_EVENTS
}

function severityAllows(minimumSeverity: AlertSeverity, alertSeverity: AlertSeverity) {
  return severityRank[alertSeverity] >= severityRank[minimumSeverity]
}

function slackEscape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function formatTimestamp(value: string) {
  return new Date(value).toISOString()
}

function getSlackStatusLabel(payload: SlackAlertPayload) {
  if (payload.event === "slack.test") return "Test"
  if (payload.alert.status === "resolved") return "Resolved"
  return "Opened"
}

function buildSlackMessage(payload: SlackAlertPayload) {
  const statusLabel = getSlackStatusLabel(payload)
  const title = `${payload.alert.severity}: ${payload.alert.title}`
  const nodeOrRule = payload.node?.label ?? payload.rule?.name ?? "Project"

  return {
    text: `[ArgusGrid] ${statusLabel}: ${title}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `ArgusGrid ${statusLabel} Alert`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${slackEscape(title)}*\n${slackEscape(payload.alert.message)}`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Project*\n${slackEscape(payload.project.name)}` },
          { type: "mrkdwn", text: `*Source*\n${slackEscape(payload.source)}` },
          { type: "mrkdwn", text: `*Node / Rule*\n${slackEscape(nodeOrRule)}` },
          { type: "mrkdwn", text: `*Status*\n${slackEscape(statusLabel)}` },
          { type: "mrkdwn", text: `*Severity*\n${payload.alert.severity}` },
          { type: "mrkdwn", text: `*Event time*\n${formatTimestamp(payload.createdAt)}` },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `ArgusGrid delivery ${payload.deliveryId}`,
          },
        ],
      },
    ],
  }
}

function getSlackFailureReason(response: Response | null, fallback?: string) {
  if (!response) return fallback ?? "Slack delivery failed."
  return fallback ?? `Slack returned HTTP ${response.status}.`
}

async function postSlackWebhook(destination: ProjectSlackDestination, payload: SlackAlertPayload) {
  return fetch(decryptSecret(destination.webhookUrlEncrypted), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "ArgusGrid-Slack/1.0",
    },
    body: JSON.stringify(buildSlackMessage(payload)),
  })
}

async function buildSlackPayload(prisma: PrismaClient, input: DeliverSlackInput, deliveryId: string): Promise<SlackAlertPayload | null> {
  if (input.eventType === "slack.test") {
    if (!input.projectId) return null
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true, name: true, slug: true },
    })
    if (!project) return null
    const now = new Date().toISOString()

    return {
      event: "slack.test",
      deliveryId,
      createdAt: now,
      project,
      node: null,
      rule: null,
      source: "Slack test",
      alert: {
        id: "test",
        title: "ArgusGrid Slack test",
        message: "This confirms that ArgusGrid can reach this Slack incoming webhook.",
        severity: "INFO",
        status: "test",
        createdAt: now,
        resolvedAt: null,
      },
    }
  }

  if (!input.alertEventId) return null
  const alert = await prisma.alertEvent.findUnique({
    where: { id: input.alertEventId },
    include: {
      node: {
        select: {
          id: true,
          label: true,
          project: { select: { id: true, name: true, slug: true } },
        },
      },
      rule: {
        select: {
          id: true,
          name: true,
          project: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  })
  if (!alert) return null
  const project = alert.node?.project ?? alert.rule?.project
  if (!project) return null

  return {
    event: input.eventType,
    deliveryId,
    createdAt: new Date().toISOString(),
    project,
    node: alert.node ? { id: alert.node.id, label: alert.node.label } : null,
    rule: alert.rule ? { id: alert.rule.id, name: alert.rule.name } : null,
    source: alert.rule ? "Alert rule" : alert.node ? "Endpoint polling" : "Project",
    alert: {
      id: alert.id,
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      status: alert.resolvedAt ? "resolved" : "open",
      createdAt: alert.createdAt.toISOString(),
      resolvedAt: alert.resolvedAt?.toISOString() ?? null,
    },
  }
}

/**
 * Validates the v1 Slack incoming webhook URL contract.
 */
export function validateSlackWebhookUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && parsed.host === "hooks.slack.com"
  } catch {
    return false
  }
}

/**
 * Encrypts a Slack incoming webhook URL before persistence.
 */
export function encryptSlackWebhookUrl(url: string) {
  return encryptSecret(url)
}

/**
 * Serializes a Slack destination without exposing its incoming webhook URL.
 */
export function serializeProjectSlackDestination(destination: ProjectSlackDestination) {
  return {
    id: destination.id,
    name: destination.name,
    enabled: destination.enabled,
    minimumSeverity: destination.minimumSeverity,
    eventFilters: normalizeSlackEvents(destination.eventFilters),
    createdAt: destination.createdAt.toISOString(),
    updatedAt: destination.updatedAt.toISOString(),
  }
}

/**
 * Sends native Slack alert messages to enabled matching project destinations.
 */
export async function deliverProjectSlack(prisma: PrismaClient, input: DeliverSlackInput) {
  const deliveryId = randomUUID()
  const payload = await buildSlackPayload(prisma, input, deliveryId)
  if (!payload) return { attempted: 0, sent: 0, failed: 0 }

  const destinations = await prisma.projectSlackDestination.findMany({
    where: {
      projectId: payload.project.id,
      ...(input.destinationId ? { id: input.destinationId } : { enabled: true }),
    },
    orderBy: { createdAt: "asc" },
  })
  const matchingDestinations = destinations
    .filter((destination) => normalizeSlackEvents(destination.eventFilters).includes(input.eventType))
    .filter((destination) => input.eventType === "slack.test" || severityAllows(destination.minimumSeverity, payload.alert.severity))

  let sent = 0
  let failed = 0

  for (const destination of matchingDestinations) {
    const attemptedAt = new Date()
    let response: Response | null = null
    let failureReason: string | undefined

    try {
      response = await postSlackWebhook(destination, payload)
      if (!response.ok) {
        failureReason = await response.text().catch(() => undefined)
        await waitForRetry()
        response = await postSlackWebhook(destination, payload)
      }
      if (!response.ok) failureReason = await response.text().catch(() => undefined)
    } catch (error) {
      failureReason = error instanceof Error ? error.message : "Slack delivery failed."
      await waitForRetry()
      try {
        response = await postSlackWebhook(destination, payload)
        failureReason = response.ok ? undefined : await response.text().catch(() => undefined)
      } catch (retryError) {
        failureReason = retryError instanceof Error ? retryError.message : "Slack delivery failed."
      }
    }

    const isSent = Boolean(response?.ok)
    if (isSent) sent += 1
    else failed += 1

    await prisma.alertNotificationDelivery.create({
      data: {
        channel: "slack",
        recipient: destination.name,
        status: isSent ? "SENT" : "FAILED",
        provider: "slack-incoming-webhook",
        providerId: deliveryId,
        failureReason: isSent ? undefined : getSlackFailureReason(response, failureReason).slice(0, 240),
        alertEventId: input.alertEventId,
        attemptedAt,
        sentAt: isSent ? new Date() : undefined,
      },
    })
  }

  return { attempted: matchingDestinations.length, sent, failed }
}
