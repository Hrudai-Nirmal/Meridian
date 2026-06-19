/**
 * Owner/admin cancellation for notification work that has not started.
 */
import { NextResponse } from "next/server"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { serializeNotificationJob } from "@/lib/notification-jobs"
import { getPrisma } from "@/lib/prisma"

/** Cancels one queued or retrying job; running work is deliberately immutable. */
export async function POST(_: Request, context: { params: Promise<{ projectId: string; jobId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error
  const { projectId, jobId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const prisma = getPrisma()
  const job = await prisma.$transaction(async (transaction) => {
    const changed = await transaction.notificationJob.updateMany({
      where: { id: jobId, projectId, status: { in: ["QUEUED", "RETRYING"] } },
      data: { status: "CANCELLED", lockedAt: null, completedAt: new Date(), lastError: "Cancelled by an operator." },
    })
    if (changed.count !== 1) return null
    await transaction.alertNotificationDelivery.updateMany({
      where: { notificationJobId: jobId },
      data: { status: "CANCELLED", failureReason: "Cancelled by an operator." },
    })
    const updated = await transaction.notificationJob.findUniqueOrThrow({ where: { id: jobId } })
    await createAuditLog(transaction, {
      action: "notification-job.cancelled",
      entity: "notification-job",
      entityId: jobId,
      projectId,
      userId,
      metadata: { channel: updated.channel, eventType: updated.eventType },
    })
    return updated
  })
  if (!job) return NextResponse.json({ error: "Only queued or retrying jobs can be cancelled." }, { status: 409 })
  return NextResponse.json({ ok: true, job: serializeNotificationJob(job) })
}
