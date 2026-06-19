/**
 * Secret-safe single notification job status endpoint.
 */
import { NextResponse } from "next/server"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { serializeNotificationJob } from "@/lib/notification-jobs"
import { getPrisma } from "@/lib/prisma"

/** Returns one project job for test-action polling. */
export async function GET(_: Request, context: { params: Promise<{ projectId: string; jobId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error
  const { projectId, jobId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN", "MEMBER", "VIEWER"])
  if (accessError) return accessError

  const job = await getPrisma().notificationJob.findFirst({ where: { id: jobId, projectId } })
  if (!job) return NextResponse.json({ error: "Notification job not found." }, { status: 404 })
  return NextResponse.json({ job: serializeNotificationJob(job) })
}
