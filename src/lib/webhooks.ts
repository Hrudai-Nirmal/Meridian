import "server-only"

import { createHmac, randomBytes, randomUUID } from "crypto"
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

type DeliverWebhookInput = {
  eventType: AlertWebhookEventType
  alertEventId?: string
  projectId?: string
  destinationId?: string
}

const WEBHOOK_EVENTS: AlertWebhookEventType[] = ["alert.opened", "alert.resolved", "webhook.test"]

function waitForRetry() {
  return new Promise((resolve) => setTimeout(resolve, 500))
}

function normalizeWebhookEvents(value: unknown) {
  if (!Array.isArray(value)) return WEBHOOK_EVENTS
  const events = value.filter((event): event is AlertWebhookEventType => WEBHOOK_EVENTS.includes(event as AlertWebhookEventType))
  return events.length ? events : WEBHOOK_EVENTS
}

function getWebhookRecipient(destination: Pick<ProjectWebhookDestination, "name" | "url">) {
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

async function buildPayload(prisma: PrismaClient, input: DeliverWebhookInput, deliveryId: string): Promise<AlertWebhookPayload | null> {
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

export async function deliverProjectWebhooks(prisma: PrismaClient, input: DeliverWebhookInput) {
  const deliveryId = randomUUID()
  const payload = await buildPayload(prisma, input, deliveryId)
  if (!payload) return { attempted: 0, sent: 0, failed: 0 }

  const destinations = await prisma.projectWebhookDestination.findMany({
    where: {
      projectId: payload.project.id,
      ...(input.destinationId ? { id: input.destinationId } : { enabled: true }),
    },
    orderBy: { createdAt: "asc" },
  })
  const matchingDestinations = destinations.filter((destination) => normalizeWebhookEvents(destination.eventFilters).includes(input.eventType))
  let sent = 0
  let failed = 0

  for (const destination of matchingDestinations) {
    const attemptedAt = new Date()
    let response: Response | null = null
    let failureReason: string | undefined

    try {
      response = await postSignedWebhook(destination, input.eventType, payload)
      if (!response.ok) {
        failureReason = `Webhook returned HTTP ${response.status}.`
        await waitForRetry()
        response = await postSignedWebhook(destination, input.eventType, payload)
      }
      if (!response.ok) failureReason = `Webhook returned HTTP ${response.status}.`
    } catch (error) {
      failureReason = error instanceof Error ? error.message : "Webhook delivery failed."
      await waitForRetry()
      try {
        response = await postSignedWebhook(destination, input.eventType, payload)
        failureReason = response.ok ? undefined : `Webhook returned HTTP ${response.status}.`
      } catch (retryError) {
        failureReason = retryError instanceof Error ? retryError.message : "Webhook delivery failed."
      }
    }

    const isSent = Boolean(response?.ok)
    if (isSent) sent += 1
    else failed += 1

    await prisma.alertNotificationDelivery.create({
      data: {
        channel: "webhook",
        recipient: getWebhookRecipient(destination),
        status: isSent ? "SENT" : "FAILED",
        provider: "webhook",
        providerId: deliveryId,
        failureReason: isSent ? undefined : failureReason ?? "Webhook delivery failed.",
        alertEventId: input.alertEventId,
        attemptedAt,
        sentAt: isSent ? new Date() : undefined,
      },
    })
  }

  return { attempted: matchingDestinations.length, sent, failed }
}
