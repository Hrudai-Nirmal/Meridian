import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId } from "@/lib/api-session"
import { getPrisma } from "@/lib/prisma"
import { assertOrganizationRole, getWorkspaceForUser } from "@/lib/workspace"

const updateMemberSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
})

async function getManagedMembership(userId: string, memberId: string) {
  const workspace = await getWorkspaceForUser(userId)
  if (!workspace) return { workspace: null, requester: null, member: null }

  const requester = await assertOrganizationRole(userId, workspace.organization.id).catch(() => null)
  if (!requester) return { workspace, requester: null, member: null }

  const prisma = getPrisma()
  const member = await prisma.membership.findFirst({
    where: {
      id: memberId,
      organizationId: workspace.organization.id,
    },
    include: { user: true },
  })

  return { workspace, requester, member }
}

export async function PATCH(request: Request, context: { params: Promise<{ memberId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { memberId } = await context.params
  const parsed = updateMemberSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid member payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const { requester, member } = await getManagedMembership(userId, memberId)
  if (!requester) {
    return NextResponse.json({ error: "Organization access denied." }, { status: 403 })
  }
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 })
  }

  if (member.role === "OWNER" && requester.role !== "OWNER") {
    return NextResponse.json({ error: "Only owners can change an owner membership." }, { status: 403 })
  }

  const prisma = getPrisma()
  if (member.role === "OWNER") {
    const ownerCount = await prisma.membership.count({
      where: { organizationId: member.organizationId, role: "OWNER" },
    })
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "An organization must keep at least one owner." }, { status: 400 })
    }
  }

  const updated = await prisma.membership.update({
    where: { id: member.id },
    data: { role: parsed.data.role },
    include: { user: true },
  })

  return NextResponse.json({
    member: {
      id: updated.id,
      name: updated.user.name ?? "Pending user",
      email: updated.user.email ?? "No email",
      role: updated.role,
    },
  })
}

export async function DELETE(_: Request, context: { params: Promise<{ memberId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { memberId } = await context.params
  const { requester, member } = await getManagedMembership(userId, memberId)
  if (!requester) {
    return NextResponse.json({ error: "Organization access denied." }, { status: 403 })
  }
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 })
  }

  if (member.role === "OWNER" && requester.role !== "OWNER") {
    return NextResponse.json({ error: "Only owners can remove an owner membership." }, { status: 403 })
  }

  const prisma = getPrisma()
  if (member.role === "OWNER") {
    const ownerCount = await prisma.membership.count({
      where: { organizationId: member.organizationId, role: "OWNER" },
    })
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "An organization must keep at least one owner." }, { status: 400 })
    }
  }

  await prisma.membership.delete({ where: { id: member.id } })
  return NextResponse.json({ ok: true })
}
