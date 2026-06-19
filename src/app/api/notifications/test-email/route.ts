import { NextResponse } from "next/server"

import { getApiUserId, requireOrganizationRole } from "@/lib/api-session"
import { getPrisma } from "@/lib/prisma"
import { sendEmailWithDeliveryLog } from "@/lib/notifications"
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

  const result = await sendEmailWithDeliveryLog(prisma, {
    to: [user.email],
    subject: "[Meridian] Test alert email",
    text: [
      "Meridian test alert email",
      "",
      "This confirms that the deployed email notification path can reach your account.",
      "",
      `Organization: ${workspace.organization.name}`,
      `Project: ${workspace.project.name}`,
    ].join("\n"),
  })

  return NextResponse.json({
    ok: result.sent > 0,
    message:
      result.sent > 0
        ? "Test email sent."
        : result.skipped > 0
          ? "Email provider is not configured."
          : result.error ?? "Test email failed.",
    result,
  })
}
