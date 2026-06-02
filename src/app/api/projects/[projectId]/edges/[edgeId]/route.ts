import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId } from "@/lib/api-session"
import { getPrisma } from "@/lib/prisma"
import { assertProjectAccess, serializeGraphForProject } from "@/lib/workspace"

const updateEdgeSchema = z.object({
  source: z.string().min(1).optional(),
  target: z.string().min(1).optional(),
  label: z.string().max(120).optional().nullable(),
})

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string; edgeId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, edgeId } = await context.params
  await assertProjectAccess(userId, projectId)

  const parsed = updateEdgeSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid edge payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()
  const existing = await prisma.graphEdge.findFirst({ where: { id: edgeId, projectId } })

  if (!existing) {
    return NextResponse.json({ error: "Edge not found." }, { status: 404 })
  }

  const sourceId = parsed.data.source ?? existing.sourceId
  const targetId = parsed.data.target ?? existing.targetId
  const endpoints = await prisma.endpointNode.count({
    where: {
      projectId,
      id: { in: [sourceId, targetId] },
    },
  })

  if (endpoints !== 2) {
    return NextResponse.json({ error: "Edge endpoints must both belong to the project." }, { status: 400 })
  }

  await prisma.graphEdge.update({
    where: { id: edgeId },
    data: {
      sourceId,
      targetId,
      ...(parsed.data.label !== undefined ? { label: parsed.data.label ?? "visual link" } : {}),
    },
  })

  const workspace = await serializeGraphForProject(userId, projectId)
  return NextResponse.json(workspace)
}

export async function DELETE(_: Request, context: { params: Promise<{ projectId: string; edgeId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, edgeId } = await context.params
  await assertProjectAccess(userId, projectId)

  const prisma = getPrisma()
  await prisma.graphEdge.deleteMany({ where: { id: edgeId, projectId } })

  const workspace = await serializeGraphForProject(userId, projectId)
  return NextResponse.json(workspace)
}
