import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireOrganizationRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { getPrisma } from "@/lib/prisma"
import { getWorkspaceForUser } from "@/lib/workspace"

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
})

export async function GET() {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const workspace = await getWorkspaceForUser(userId)
  if (!workspace) {
    return NextResponse.json({ members: [], invitations: [] })
  }

  return NextResponse.json({
    members: workspace.members,
    invitations: workspace.invitations,
  })
}

export async function POST(request: Request) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const workspace = await getWorkspaceForUser(userId)
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 })
  }

  const accessError = await requireOrganizationRole(userId, workspace.organization.id)
  if (accessError) return accessError

  const parsed = inviteSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invite payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()
  const email = parsed.data.email.toLowerCase()
  const existingMember = await prisma.membership.findFirst({
    where: {
      organizationId: workspace.organization.id,
      user: { email },
    },
    select: { id: true },
  })
  if (existingMember) {
    return NextResponse.json({ error: "That email is already a workspace member." }, { status: 409 })
  }

  const pendingInvitation = await prisma.teamInvitation.findFirst({
    where: {
      email,
      organizationId: workspace.organization.id,
      status: "PENDING",
    },
    select: { id: true, email: true, role: true, status: true, createdAt: true },
  })
  if (pendingInvitation) {
    await createAuditLog(prisma, {
      action: "team.invite_duplicate",
      entity: "team",
      entityId: pendingInvitation.id,
      organizationId: workspace.organization.id,
      projectId: workspace.project.id,
      userId,
      metadata: { email: pendingInvitation.email, role: pendingInvitation.role },
    })
    return NextResponse.json({
      invitation: pendingInvitation,
      message: "A pending invitation already exists for this email.",
    })
  }

  const invitation = await prisma.teamInvitation.create({
    data: {
      email,
      role: parsed.data.role,
      organizationId: workspace.organization.id,
      invitedById: userId,
    },
    select: { id: true, email: true, role: true, status: true, createdAt: true },
  })
  await createAuditLog(prisma, {
    action: "team.invited",
    entity: "team",
    entityId: invitation.id,
    organizationId: workspace.organization.id,
    projectId: workspace.project.id,
    userId,
    metadata: { email: invitation.email, role: invitation.role },
  })

  return NextResponse.json({ invitation }, { status: 201 })
}
