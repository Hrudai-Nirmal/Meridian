import "server-only"

import { createHmac, randomBytes } from "crypto"
import type { AlertSeverity, PrismaClient, ProjectWebhookDestination } from "@prisma/client"

import { decryptSecret, encryptSecret } from "@/lib/crypto"

export type AlertWebhookEventType = "alert.opened" | "alert.resolved" | "webhook.test"

type AlertWebhookAlert = {
  id: string
  title: string
  message: string
  severity: AlertSeverity
  status: "open" | "resolved" | "test"
  createdAt: string
  resolvedAt: string | null
}

type AlertWebhookProject = {
  id: string
  name: string
  slug: string
}

type AlertWebhookNode = {
  id: string
  label: string
} | null

type AlertWebhookRule = {
  id: string
  name: string
} | null

type AlertWebhookPayload = {
  event: AlertWebhookEventType
  deliveryId: string
  createdAt: string
  project: AlertWebhookProject
  node: AlertWebhookNode
  rule: AlertWebhookRule
  source: string
  alert: AlertWebhookAlert
  meridian: {
    product: "Meridian"
    version: "webhook-v1"
  }
  /** @deprecated Retained for existing webhook consumers during the Meridian migration. */
  argusgrid: {
    product: "Meridian"
    version: "webhook-v1"
  }
}

type SendWebhookAttemptInput = {
  jobId: string
  eventType: AlertWebhookEventType
  alertEventId?: string
  projectId: string
  destinationId: string
}

const WEBHOOK_EVENTS: AlertWebhookEventType[] = ["alert.opened", "alert.resolved", "webhook.test"]

export function normalizeWebhookEvents(value: unknown) {
  if (!Array.isArray(value)) return WEBHOOK_EVENTS
  const events = value.filter((event): event is AlertWebhookEventType => WEBHOOK_EVENTS.includes(event as AlertWebhookEventType))
  return events.length ? events : WEBHOOK_EVENTS
}

export function getWebhookRecipient(destination: Pick<ProjectWebhookDestination, "name" | "url">) {
  try {
    return `${destination.name} (${new URL(destination.url).host})`
  } catch {
    return destination.name
  }
}

function signWebhookBody(secret: string, timestamp: string, body: string) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`
}

function serializeWebhookDestination(destination: ProjectWebhookDestination) {
  return {
    id: destination.id,
    name: destination.name,
    url: destination.url,
    enabled: destination.enabled,
    eventFilters: normalizeWebhookEvents(destination.eventFilters),
    createdAt: destination.createdAt.toISOString(),
    updatedAt: destination.updatedAt.toISOString(),
  }
}

export function createWebhookSigningSecret() {
  return randomBytes(32).toString("hex")
}

export function encryptWebhookSigningSecret(secret: string) {
  return encryptSecret(secret)
}

export function serializeProjectWebhook(destination: ProjectWebhookDestination) {
  return serializeWebhookDestination(destination)
}

async function postSignedWebhook(destination: ProjectWebhookDestination, eventType: AlertWebhookEventType, payload: AlertWebhookPayload) {
  const timestamp = new Date().toISOString()
  const body = JSON.stringify(payload)
  const signature = signWebhookBody(decryptSecret(destination.signingSecretEncrypted), timestamp, body)

  return fetch(destination.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Meridian-Webhooks/1.0",
      "X-Meridian-Event": eventType,
      "X-Meridian-Delivery": payload.deliveryId,
      "X-Meridian-Timestamp": timestamp,
      "X-Meridian-Signature": signature,
      // Legacy headers keep existing receivers working through the product rename.
      "X-ArgusGrid-Event": eventType,
      "X-ArgusGrid-Delivery": payload.deliveryId,
      "X-ArgusGrid-Timestamp": timestamp,
      "X-ArgusGrid-Signature": signature,
    },
    body,
  })
}

async function buildPayload(prisma: PrismaClient, input: SendWebhookAttemptInput, deliveryId: string): Promise<AlertWebhookPayload | null> {
  if (input.eventType === "webhook.test") {
    if (!input.projectId) return null
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true, name: true, slug: true },
    })
    if (!project) return null
    const now = new Date().toISOString()

    return {
      event: "webhook.test",
      deliveryId,
      createdAt: now,
      project,
      node: null,
      rule: null,
      source: "Webhook test",
      alert: {
        id: "test",
        title: "Meridian webhook test",
        message: "This confirms that Meridian can reach this webhook destination.",
        severity: "INFO",
        status: "test",
        createdAt: now,
        resolvedAt: null,
      },
      meridian: { product: "Meridian", version: "webhook-v1" },
      argusgrid: { product: "Meridian", version: "webhook-v1" },
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
    meridian: { product: "Meridian", version: "webhook-v1" },
    argusgrid: { product: "Meridian", version: "webhook-v1" },
  }
}

/** Performs one signed webhook attempt for a queued destination. */
export async function sendWebhookAttempt(prisma: PrismaClient, input: SendWebhookAttemptInput) {
  const destination = await prisma.projectWebhookDestination.findFirst({
    where: { id: input.destinationId, projectId: input.projectId },
  })
  if (!destination?.enabled) return { skipped: true, reason: "Webhook destination is disabled or unavailable." }
  if (!normalizeWebhookEvents(destination.eventFilters).includes(input.eventType)) {
    return { skipped: true, reason: "Webhook destination no longer accepts this event." }
  }

  const payload = await buildPayload(prisma, input, input.jobId)
  if (!payload) return { skipped: true, reason: "Webhook source data is unavailable." }
  const response = await postSignedWebhook(destination, input.eventType, payload)
  if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}.`)
  return { skipped: false, providerId: input.jobId }
}
