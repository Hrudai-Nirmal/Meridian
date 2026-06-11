import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { getPrisma } from "@/lib/prisma"
import { serializeGraphForProject } from "@/lib/workspace"

const createEdgeSchema = z.object({
  id: z.string().min(1).optional(),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().max(120).optional().nullable(),
})

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId)
  if (accessError) return accessError

  const parsed = createEdgeSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid edge payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()
  const endpoints = await prisma.endpointNode.count({
    where: {
      projectId,
      id: { in: [parsed.data.source, parsed.data.target] },
    },
  })

  if (endpoints !== 2) {
    return NextResponse.json({ error: "Edge endpoints must both belong to the project." }, { status: 400 })
  }

  await prisma.graphEdge.create({
    data: {
      id: parsed.data.id ?? randomUUID(),
      sourceId: parsed.data.source,
      targetId: parsed.data.target,
      label: parsed.data.label ?? "visual link",
      projectId,
    },
  })

  const workspace = await serializeGraphForProject(userId, projectId)
  return NextResponse.json(workspace, { status: 201 })
}
