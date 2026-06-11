import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireOrganizationRole } from "@/lib/api-session"
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
  const invitation = await prisma.teamInvitation.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      organizationId: workspace.organization.id,
      invitedById: userId,
    },
  })

  return NextResponse.json({ invitation }, { status: 201 })
}
