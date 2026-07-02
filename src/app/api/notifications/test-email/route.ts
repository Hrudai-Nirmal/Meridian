import { NextResponse } from "next/server"

import { getApiUserId, requireOrganizationRole } from "@/lib/api-session"
import { dispatchNotificationJobs, queueTestEmailJob } from "@/lib/notification-jobs"
import { getPrisma } from "@/lib/prisma"
import { getWorkspaceForUser } from "@/lib/workspace"

export async function POST() {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const workspace = await getWorkspaceForUser(userId)
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 })
  }

  const accessError = await requireOrganizationRole(userId, workspace.organization.id)
  if (accessError) return accessError

  const prisma = getPrisma()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  })

  if (!user?.email) {
    return NextResponse.json({ error: "Your account does not have an email address." }, { status: 400 })
  }

  const job = await queueTestEmailJob(prisma, { projectId: workspace.project.id, recipient: user.email })
  const dispatch = await dispatchNotificationJobs([job])

  return NextResponse.json({
    ok: true,
    queued: true,
    dispatched: dispatch.dispatched === 1,
    message: "Test email queued.",
    jobId: job.id,
  }, { status: 202 })
}
