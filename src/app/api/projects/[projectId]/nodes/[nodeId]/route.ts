import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { getPrisma } from "@/lib/prisma"
import { assertProjectAccess, serializeGraphForProject, workspaceConverters } from "@/lib/workspace"

const nodeStatusSchema = z.enum(["active", "degraded", "down", "unknown"])

const updateNodeSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().min(1).max(64).optional(),
  status: nodeStatusSchema.optional(),
  statusReason: z.string().max(240).optional().nullable(),
  override: nodeStatusSchema.optional().nullable(),
  category: z.string().min(1).max(120).optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  apiUrl: z.string().max(2048).optional().nullable(),
  cadence: z.string().max(80).optional().nullable(),
  auth: z.string().max(80).optional().nullable(),
})

export async function GET(_: Request, context: { params: Promise<{ projectId: string; nodeId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, nodeId } = await context.params
  const accessError = await requireProjectRole(userId, projectId)
  if (accessError) return accessError

  const prisma = getPrisma()

  const node = await prisma.endpointNode.findFirst({ where: { id: nodeId, projectId }, select: { id: true } })
  if (!node) {
    return NextResponse.json({ error: "Node not found." }, { status: 404 })
  }

  return NextResponse.json({ node })
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string; nodeId: string }> }) {
  return updateNode(request, context)
}

export async function DELETE(_: Request, context: { params: Promise<{ projectId: string; nodeId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, nodeId } = await context.params
  const accessError = await requireProjectRole(userId, projectId)
  if (accessError) return accessError

  const prisma = getPrisma()

  await prisma.$transaction([
    prisma.graphEdge.deleteMany({
      where: {
        projectId,
        OR: [{ sourceId: nodeId }, { targetId: nodeId }],
      },
    }),
    prisma.endpointNode.deleteMany({ where: { id: nodeId, projectId } }),
  ])

  const workspace = await serializeGraphForProject(userId, projectId)
  return NextResponse.json(workspace)
}

async function updateNode(request: Request, context: { params: Promise<{ projectId: string; nodeId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, nodeId } = await context.params
  await assertProjectAccess(userId, projectId)

  const parsed = updateNodeSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid node payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()

  const updateData = {
    ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
    ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
    ...(parsed.data.icon !== undefined ? { iconKind: parsed.data.icon } : {}),
    ...(parsed.data.status !== undefined ? { status: workspaceConverters.toEndpointStatus(parsed.data.status) } : {}),
    ...(parsed.data.statusReason !== undefined ? { statusReason: parsed.data.statusReason } : {}),
    ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
    ...(parsed.data.x !== undefined ? { x: parsed.data.x } : {}),
    ...(parsed.data.y !== undefined ? { y: parsed.data.y } : {}),
  }

  if (Object.keys(updateData).length) {
    const result = await prisma.endpointNode.updateMany({
      where: { id: nodeId, projectId },
      data: updateData,
    })

    if (!result.count) {
      return NextResponse.json({ error: "Node not found." }, { status: 404 })
    }
  } else {
    const node = await prisma.endpointNode.findFirst({ where: { id: nodeId, projectId }, select: { id: true } })
    if (!node) {
      return NextResponse.json({ error: "Node not found." }, { status: 404 })
    }
  }

  if (parsed.data.apiUrl !== undefined || parsed.data.cadence !== undefined || parsed.data.auth !== undefined) {
    await prisma.apiEndpointConfig.upsert({
      where: { nodeId },
      update: {
        ...(parsed.data.apiUrl !== undefined ? { url: parsed.data.apiUrl ?? "https://api.example.com/endpoint" } : {}),
        ...(parsed.data.cadence !== undefined ? { cadenceMin: workspaceConverters.toCadenceMinutes(parsed.data.cadence) } : {}),
        ...(parsed.data.auth !== undefined ? { authType: workspaceConverters.toAuthType(parsed.data.auth) } : {}),
      },
      create: {
        nodeId,
        url: parsed.data.apiUrl ?? "https://api.example.com/endpoint",
        method: "GET",
        authType: workspaceConverters.toAuthType(parsed.data.auth),
        cadenceMin: workspaceConverters.toCadenceMinutes(parsed.data.cadence),
      },
    })
  }

  if (parsed.data.override !== undefined) {
    if (parsed.data.override) {
      await prisma.nodeStatusOverride.upsert({
        where: { nodeId },
        update: {
          status: workspaceConverters.toEndpointStatus(parsed.data.override),
          reason: "Manual dashboard override",
        },
        create: {
          nodeId,
          status: workspaceConverters.toEndpointStatus(parsed.data.override),
          reason: "Manual dashboard override",
        },
      })
    } else {
      await prisma.nodeStatusOverride.deleteMany({ where: { nodeId } })
    }
  }

  const workspace = await serializeGraphForProject(userId, projectId)
  return NextResponse.json(workspace)
}
