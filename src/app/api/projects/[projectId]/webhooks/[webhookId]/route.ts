import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { getPrisma } from "@/lib/prisma"
import { serializeProjectWebhook } from "@/lib/webhooks"

const webhookEvents = ["alert.opened", "alert.resolved", "webhook.test"] as const

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  url: z.string().url().max(2048).optional(),
  enabled: z.boolean().optional(),
  eventFilters: z.array(z.enum(webhookEvents)).optional(),
})

function validateWebhookUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
  } catch {
    return false
  }
}

function getWebhookHost(url: string) {
  try {
    return new URL(url).host
  } catch {
    return "configured endpoint"
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string; webhookId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, webhookId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const parsed = updateWebhookSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid webhook payload.", details: parsed.error.flatten() }, { status: 400 })
  }
  if (parsed.data.url && !validateWebhookUrl(parsed.data.url)) {
    return NextResponse.json({ error: "Webhook URL must use HTTP or HTTPS." }, { status: 400 })
  }

  const prisma = getPrisma()
  const existing = await prisma.projectWebhookDestination.findFirst({ where: { id: webhookId, projectId } })
  if (!existing) {
    return NextResponse.json({ error: "Webhook destination not found." }, { status: 404 })
  }

  const webhook = await prisma.projectWebhookDestination.update({
    where: { id: webhookId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.url !== undefined ? { url: parsed.data.url } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.eventFilters !== undefined ? { eventFilters: parsed.data.eventFilters } : {}),
    },
  })
  await createAuditLog(prisma, {
    action: "webhook.updated",
    entity: "webhook",
    entityId: webhook.id,
    projectId,
    userId,
    metadata: { name: webhook.name, host: getWebhookHost(webhook.url), enabled: webhook.enabled, eventFilters: webhook.eventFilters },
  })

  return NextResponse.json({ webhook: serializeProjectWebhook(webhook) })
}

export async function DELETE(_: Request, context: { params: Promise<{ projectId: string; webhookId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, webhookId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const prisma = getPrisma()
  const webhook = await prisma.projectWebhookDestination.findFirst({
    where: { id: webhookId, projectId },
    select: { id: true, name: true, url: true },
  })
  if (!webhook) {
    return NextResponse.json({ error: "Webhook destination not found." }, { status: 404 })
  }

  await prisma.projectWebhookDestination.delete({ where: { id: webhook.id } })
  await createAuditLog(prisma, {
    action: "webhook.deleted",
    entity: "webhook",
    entityId: webhook.id,
    projectId,
    userId,
    metadata: { name: webhook.name, host: getWebhookHost(webhook.url) },
  })

  return NextResponse.json({ ok: true })
}
