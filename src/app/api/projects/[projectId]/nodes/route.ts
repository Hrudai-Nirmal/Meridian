import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId } from "@/lib/api-session"
import { getPrisma } from "@/lib/prisma"
import { assertProjectAccess, serializeGraphForProject, workspaceConverters } from "@/lib/workspace"

const createNodeSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().min(1).max(120).default("New endpoint"),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().min(1).max(64).default("api"),
  category: z.string().min(1).max(120).default("Execution Health"),
  x: z.number().finite().default(460),
  y: z.number().finite().default(320),
  apiUrl: z.string().max(2048).optional().nullable(),
  cadence: z.string().max(80).optional().nullable(),
  auth: z.string().max(80).optional().nullable(),
})

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  await assertProjectAccess(userId, projectId)

  const parsed = createNodeSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid node payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()
  const id = parsed.data.id ?? randomUUID()

  const existing = await prisma.endpointNode.findUnique({ where: { id }, select: { projectId: true } })
  if (existing && existing.projectId !== projectId) {
    return NextResponse.json({ error: "Node id is already used by another project." }, { status: 409 })
  }

  await prisma.endpointNode.upsert({
    where: { id },
    update: {
      label: parsed.data.label,
      description: parsed.data.description,
      iconKind: parsed.data.icon,
      category: parsed.data.category,
      x: parsed.data.x,
      y: parsed.data.y,
    },
    create: {
      id,
      label: parsed.data.label,
      description: parsed.data.description,
      iconKind: parsed.data.icon,
      status: "UNKNOWN",
      statusReason: "No poll has run yet.",
      category: parsed.data.category,
      x: parsed.data.x,
      y: parsed.data.y,
      projectId,
      endpointConfig: {
        create: {
          url: parsed.data.apiUrl ?? "https://api.example.com/endpoint",
          method: "GET",
          authType: workspaceConverters.toAuthType(parsed.data.auth),
          cadenceMin: workspaceConverters.toCadenceMinutes(parsed.data.cadence),
        },
      },
    },
  })

  const workspace = await serializeGraphForProject(userId, projectId)
  return NextResponse.json(workspace, { status: 201 })
}
