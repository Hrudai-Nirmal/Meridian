/**
 * Owner/admin recovery action for a terminal failed notification job.
 */
import { NextResponse } from "next/server"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { dispatchNotificationJobs, serializeNotificationJob } from "@/lib/notification-jobs"
import { getPrisma } from "@/lib/prisma"

/** Requeues one failed job with a new dispatch generation. */
export async function POST(_: Request, context: { params: Promise<{ projectId: string; jobId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error
  const { projectId, jobId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const prisma = getPrisma()
  const job = await prisma.$transaction(async (transaction) => {
    const changed = await transaction.notificationJob.updateMany({
      where: { id: jobId, projectId, status: "FAILED" },
      data: { status: "QUEUED", generation: { increment: 1 }, attemptCount: 0, lockedAt: null, lastError: null, completedAt: null },
    })
    if (changed.count !== 1) return null
    await transaction.alertNotificationDelivery.updateMany({
      where: { notificationJobId: jobId },
      data: { status: "QUEUED", failureReason: null, providerId: null, sentAt: null },
    })
    const updated = await transaction.notificationJob.findUniqueOrThrow({ where: { id: jobId } })
    await createAuditLog(transaction, {
      action: "notification-job.retried",
      entity: "notification-job",
      entityId: jobId,
      projectId,
      userId,
      metadata: { channel: updated.channel, eventType: updated.eventType, generation: updated.generation },
    })
    return updated
  })
  if (!job) return NextResponse.json({ error: "Only failed jobs can be retried." }, { status: 409 })
  await dispatchNotificationJobs([{ id: job.id, generation: job.generation }])
  return NextResponse.json({ ok: true, job: serializeNotificationJob(job) }, { status: 202 })
}
