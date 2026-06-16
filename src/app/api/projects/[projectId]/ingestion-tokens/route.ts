import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { createIngestionToken } from "@/lib/ingestion-tokens"
import { getPrisma } from "@/lib/prisma"

const tokenSchema = z.object({
  name: z.string().min(1).max(80).default("Workflow telemetry token"),
})

function serializeToken(token: {
  id: string
  name: string
  prefix: string
  createdAt: Date
  lastUsedAt: Date | null
  revokedAt: Date | null
}) {
  return {
    id: token.id,
    name: token.name,
    prefix: token.prefix,
    createdAt: token.createdAt.toISOString(),
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    revokedAt: token.revokedAt?.toISOString() ?? null,
  }
}

export async function GET(_: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const prisma = getPrisma()
  const tokens = await prisma.ingestionToken.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  })

  return NextResponse.json({ tokens: tokens.map(serializeToken) })
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const parsed = tokenSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const created = await createIngestionToken({
    projectId,
    userId,
    name: parsed.data.name,
  })
  await createAuditLog(getPrisma(), {
    action: "token.created",
    entity: "token",
    entityId: created.tokenRecord.id,
    projectId,
    userId,
    metadata: { name: created.tokenRecord.name, prefix: created.tokenRecord.prefix },
  })

  return NextResponse.json({ token: created.token, tokenRecord: created.tokenRecord })
}
