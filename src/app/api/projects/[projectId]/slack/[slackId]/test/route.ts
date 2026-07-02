/**
 * Sends a native Slack test event to one project destination.
 */
import { NextResponse } from "next/server"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { dispatchNotificationJobs, queueTestSlackJob } from "@/lib/notification-jobs"
import { getPrisma } from "@/lib/prisma"

export async function POST(_: Request, context: { params: Promise<{ projectId: string; slackId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, slackId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const prisma = getPrisma()
  const destination = await prisma.projectSlackDestination.findFirst({
    where: { id: slackId, projectId },
    select: { id: true, name: true },
  })
  if (!destination) {
    return NextResponse.json({ error: "Slack destination not found." }, { status: 404 })
  }

  const job = await queueTestSlackJob(prisma, { projectId, destinationId: slackId, recipient: destination.name })
  const dispatch = await dispatchNotificationJobs([job])
  await createAuditLog(prisma, {
    action: "slack.tested",
    entity: "slack",
    entityId: destination.id,
    projectId,
    userId,
    metadata: { name: destination.name, jobId: job.id, status: "QUEUED" },
  })

  return NextResponse.json({
    ok: true,
    queued: true,
    dispatched: dispatch.dispatched === 1,
    message: "Slack test queued.",
    jobId: job.id,
  }, { status: 202 })
}
