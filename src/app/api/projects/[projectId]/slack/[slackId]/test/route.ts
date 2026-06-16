/**
 * Sends a native Slack test event to one project destination.
 */
import { NextResponse } from "next/server"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { getPrisma } from "@/lib/prisma"
import { deliverProjectSlack } from "@/lib/slack"

export async function POST(_: Request, context: { params: Promise<{ projectId: string; slackId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, slackId } = await context.params
  const accessError = await requireProjectRole(userId, projectId)
  if (accessError) return accessError

  const prisma = getPrisma()
  const destination = await prisma.projectSlackDestination.findFirst({
    where: { id: slackId, projectId },
    select: { id: true, name: true },
  })
  if (!destination) {
    return NextResponse.json({ error: "Slack destination not found." }, { status: 404 })
  }

  const result = await deliverProjectSlack(prisma, {
    eventType: "slack.test",
    projectId,
    destinationId: slackId,
  })
  await createAuditLog(prisma, {
    action: "slack.tested",
    entity: "slack",
    entityId: destination.id,
    projectId,
    userId,
    metadata: { name: destination.name, sent: result.sent, failed: result.failed },
  })

  return NextResponse.json({
    ok: result.sent > 0,
    message: result.sent > 0 ? "Slack test delivered." : "Slack test failed.",
    result,
  })
}
