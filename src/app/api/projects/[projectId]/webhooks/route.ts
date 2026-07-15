import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { getPrisma } from "@/lib/prisma"
import {
  createWebhookSigningSecret,
  encryptWebhookSigningSecret,
  serializeProjectWebhook,
} from "@/lib/webhooks"

const webhookEvents = ["alert.opened", "alert.resolved", "webhook.test"] as const

const webhookSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url().max(2048),
  enabled: z.boolean().default(true),
  eventFilters: z.array(z.enum(webhookEvents)).default(["alert.opened", "alert.resolved", "webhook.test"]),
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

export async function GET(_: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const prisma = getPrisma()
  const webhooks = await prisma.projectWebhookDestination.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ webhooks: webhooks.map(serializeProjectWebhook) })
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const parsed = webhookSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid webhook payload.", details: parsed.error.flatten() }, { status: 400 })
  }
  if (!validateWebhookUrl(parsed.data.url)) {
    return NextResponse.json({ error: "Webhook URL must use HTTP or HTTPS." }, { status: 400 })
  }

  const prisma = getPrisma()
  const projectExists = await prisma.project.count({ where: { id: projectId } })
  if (!projectExists) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 })
  }

  const signingSecret = createWebhookSigningSecret()
  const webhook = await prisma.projectWebhookDestination.create({
    data: {
      name: parsed.data.name,
      url: parsed.data.url,
      enabled: parsed.data.enabled,
      eventFilters: parsed.data.eventFilters,
      signingSecretEncrypted: encryptWebhookSigningSecret(signingSecret),
      projectId,
    },
  })
  await createAuditLog(prisma, {
    action: "webhook.created",
    entity: "webhook",
    entityId: webhook.id,
    projectId,
    userId,
    metadata: { name: webhook.name, host: getWebhookHost(webhook.url), enabled: webhook.enabled, eventFilters: webhook.eventFilters },
  })
  return NextResponse.json(
    {
      webhook: serializeProjectWebhook(webhook),
      signingSecret,
    },
    { status: 201 }
  )
}
