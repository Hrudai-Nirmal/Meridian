import { NextResponse } from "next/server"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { getPrisma } from "@/lib/prisma"

export async function DELETE(_: Request, context: { params: Promise<{ projectId: string; shareId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, shareId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const prisma = getPrisma()
  const share = await prisma.reportShare.findFirst({
    where: { id: shareId, projectId },
  })

  if (!share) {
    return NextResponse.json({ error: "Report share not found." }, { status: 404 })
  }

  await prisma.reportShare.update({
    where: { id: shareId },
    data: { revokedAt: new Date() },
  })
  await createAuditLog(prisma, {
    action: "report.revoked",
    entity: "report",
    entityId: share.id,
    projectId,
    userId,
    metadata: { title: share.title, clientName: share.clientName },
  })

  return NextResponse.json({ ok: true })
}
