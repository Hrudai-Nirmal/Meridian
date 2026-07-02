import { NextResponse } from "next/server"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { dispatchNotificationJobs, queueTestWebhookJob } from "@/lib/notification-jobs"
import { getPrisma } from "@/lib/prisma"
import { getWebhookRecipient } from "@/lib/webhooks"

export async function POST(_: Request, context: { params: Promise<{ projectId: string; webhookId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, webhookId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const prisma = getPrisma()
  const webhook = await prisma.projectWebhookDestination.findFirst({
    where: { id: webhookId, projectId },
  })
  if (!webhook) {
    return NextResponse.json({ error: "Webhook destination not found." }, { status: 404 })
  }

  const job = await queueTestWebhookJob(prisma, { projectId, destinationId: webhookId, recipient: getWebhookRecipient(webhook) })
  const dispatch = await dispatchNotificationJobs([job])
  await createAuditLog(prisma, {
    action: "webhook.tested",
    entity: "webhook",
    entityId: webhook.id,
    projectId,
    userId,
    metadata: { name: webhook.name, jobId: job.id, status: "QUEUED" },
  })

  return NextResponse.json({
    ok: true,
    queued: true,
    dispatched: dispatch.dispatched === 1,
    message: "Test webhook queued.",
    jobId: job.id,
  }, { status: 202 })
}
