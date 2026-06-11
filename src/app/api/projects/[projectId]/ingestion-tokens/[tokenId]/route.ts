import { NextResponse } from "next/server"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { getPrisma } from "@/lib/prisma"

export async function DELETE(_: Request, context: { params: Promise<{ projectId: string; tokenId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, tokenId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const prisma = getPrisma()
  const existing = await prisma.ingestionToken.findFirst({
    where: { id: tokenId, projectId },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: "Ingestion token not found." }, { status: 404 })
  }

  await prisma.ingestionToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
