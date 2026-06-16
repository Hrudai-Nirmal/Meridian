import { NextResponse } from "next/server"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { getPrisma } from "@/lib/prisma"
import { deliverProjectWebhooks } from "@/lib/webhooks"

export async function POST(_: Request, context: { params: Promise<{ projectId: string; webhookId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, webhookId } = await context.params
  const accessError = await requireProjectRole(userId, projectId)
  if (accessError) return accessError

  const prisma = getPrisma()
  const webhook = await prisma.projectWebhookDestination.findFirst({
    where: { id: webhookId, projectId },
    select: { id: true, name: true },
  })
  if (!webhook) {
    return NextResponse.json({ error: "Webhook destination not found." }, { status: 404 })
  }

  const result = await deliverProjectWebhooks(prisma, {
    eventType: "webhook.test",
    projectId,
    destinationId: webhookId,
  })
  await createAuditLog(prisma, {
    action: "webhook.tested",
    entity: "webhook",
    entityId: webhook.id,
    projectId,
    userId,
    metadata: { name: webhook.name, sent: result.sent, failed: result.failed },
  })

  return NextResponse.json({
    ok: result.sent > 0,
    message: result.sent > 0 ? "Test webhook delivered." : "Test webhook failed.",
    result,
  })
}
