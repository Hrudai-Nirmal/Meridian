/**
 * Native Slack incoming-webhook delivery for project alert incidents.
 */
import "server-only"

import type { AlertSeverity, PrismaClient, ProjectSlackDestination } from "@prisma/client"

import { decryptSecret, encryptSecret } from "@/lib/crypto"
import { canUseExternalSideEffects } from "@/lib/runtime-environment"

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

type SendSlackAttemptInput = {
  jobId: string
  eventType: SlackAlertEventType
  alertEventId?: string
  projectId: string
  destinationId: string
}

const SLACK_EVENTS: SlackAlertEventType[] = ["alert.opened", "alert.resolved", "slack.test"]

const severityRank: Record<AlertSeverity, number> = {
  INFO: 0,
  WARNING: 1,
  CRITICAL: 2,
}

export function normalizeSlackEvents(value: unknown) {
  if (!Array.isArray(value)) return SLACK_EVENTS
  const events = value.filter((event): event is SlackAlertEventType => SLACK_EVENTS.includes(event as SlackAlertEventType))
  return events.length ? events : SLACK_EVENTS
}

export function slackSeverityAllows(minimumSeverity: AlertSeverity, alertSeverity: AlertSeverity) {
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
    text: `[Meridian] ${statusLabel}: ${title}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `Meridian ${statusLabel} Alert`,
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
            text: `Meridian delivery ${payload.deliveryId}`,
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
      "User-Agent": "Meridian-Slack/1.0",
    },
    body: JSON.stringify(buildSlackMessage(payload)),
  })
}

async function buildSlackPayload(prisma: PrismaClient, input: SendSlackAttemptInput, deliveryId: string): Promise<SlackAlertPayload | null> {
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
        title: "Meridian Slack test",
        message: "This confirms that Meridian can reach this Slack incoming webhook.",
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
 * Performs one native Slack attempt for a queued destination.
 */
export async function sendSlackAttempt(prisma: PrismaClient, input: SendSlackAttemptInput) {
  if (!canUseExternalSideEffects()) return { skipped: true, reason: "Slack delivery is disabled in this runtime." }
  const destination = await prisma.projectSlackDestination.findFirst({
    where: { id: input.destinationId, projectId: input.projectId },
  })
  if (!destination?.enabled) return { skipped: true, reason: "Slack destination is disabled or unavailable." }
  if (!normalizeSlackEvents(destination.eventFilters).includes(input.eventType)) {
    return { skipped: true, reason: "Slack destination no longer accepts this event." }
  }

  const payload = await buildSlackPayload(prisma, input, input.jobId)
  if (!payload) return { skipped: true, reason: "Slack source data is unavailable." }
  if (input.eventType !== "slack.test" && !slackSeverityAllows(destination.minimumSeverity, payload.alert.severity)) {
    return { skipped: true, reason: "Alert no longer meets the Slack severity filter." }
  }

  const response = await postSlackWebhook(destination, payload)
  if (!response.ok) {
    const reason = await response.text().catch(() => undefined)
    throw new Error(getSlackFailureReason(response, reason).slice(0, 240))
  }
  return { skipped: false, providerId: input.jobId }
}
