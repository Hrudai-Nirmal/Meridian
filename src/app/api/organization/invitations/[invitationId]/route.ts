import { NextResponse } from "next/server"

import { getApiUserId, requireOrganizationRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
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
  const invitation = await prisma.teamInvitation.findFirst({
    where: {
      id: invitationId,
      organizationId: workspace.organization.id,
      status: "PENDING",
    },
    select: { id: true, email: true, role: true },
  })
  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 })
  }

  await prisma.teamInvitation.update({
    where: {
      id: invitation.id,
    },
    data: { status: "CANCELLED" },
  })
  await createAuditLog(prisma, {
    action: "team.invite_cancelled",
    entity: "team",
    entityId: invitation.id,
    organizationId: workspace.organization.id,
    projectId: workspace.project.id,
    userId,
    metadata: { email: invitation.email, role: invitation.role },
  })

  return NextResponse.json({ ok: true })
}
