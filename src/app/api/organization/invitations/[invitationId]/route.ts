import { NextResponse } from "next/server"

import { getApiUserId, requireOrganizationRole } from "@/lib/api-session"
import { getPrisma } from "@/lib/prisma"
import { getWorkspaceForUser } from "@/lib/workspace"

export async function DELETE(_: Request, context: { params: Promise<{ invitationId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const workspace = await getWorkspaceForUser(userId)
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 })
  }

  const accessError = await requireOrganizationRole(userId, workspace.organization.id)
  if (accessError) return accessError

  const { invitationId } = await context.params
  const prisma = getPrisma()
  const result = await prisma.teamInvitation.updateMany({
    where: {
      id: invitationId,
      organizationId: workspace.organization.id,
      status: "PENDING",
    },
    data: { status: "CANCELLED" },
  })

  if (!result.count) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
