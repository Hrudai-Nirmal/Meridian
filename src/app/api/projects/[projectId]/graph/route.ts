import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { getPrisma } from "@/lib/prisma"
import { serializeGraphForProject, workspaceConverters } from "@/lib/workspace"

const nodeStatusSchema = z.enum(["active", "degraded", "down", "unknown"])

const graphSaveSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1).max(120),
      description: z.string().max(500).optional().nullable(),
      icon: z.string().min(1).max(64),
      status: nodeStatusSchema,
      statusReason: z.string().max(240).optional().nullable(),
      override: nodeStatusSchema.optional().nullable(),
      category: z.string().min(1).max(120),
      apiUrl: z.string().max(2048).optional().nullable(),
      cadence: z.string().max(80).optional().nullable(),
      auth: z.string().max(80).optional().nullable(),
      position: z.object({
        x: z.number().finite(),
        y: z.number().finite(),
      }),
    })
  ),
  edges: z.array(
    z.object({
      id: z.string().min(1),
      source: z.string().min(1),
      target: z.string().min(1),
      label: z.string().max(120).optional().nullable(),
    })
  ),
})

export async function GET(_: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const workspace = await serializeGraphForProject(userId, projectId)

  if (!workspace) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 })
  }

  return NextResponse.json(workspace)
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId)
  if (accessError) return accessError

  const parsed = graphSaveSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid graph payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()
  const nodeIds = parsed.data.nodes.map((node) => node.id)
  const edgeIds = parsed.data.edges.map((edge) => edge.id)

  const [foreignNode, foreignEdge] = await Promise.all([
    nodeIds.length
      ? prisma.endpointNode.findFirst({
          where: { id: { in: nodeIds }, projectId: { not: projectId } },
          select: { id: true },
        })
      : null,
    edgeIds.length
      ? prisma.graphEdge.findFirst({
          where: { id: { in: edgeIds }, projectId: { not: projectId } },
          select: { id: true },
        })
      : null,
  ])

  if (foreignNode || foreignEdge) {
    return NextResponse.json({ error: "Graph payload contains resources from another project." }, { status: 409 })
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.graphEdge.deleteMany({
      where: {
        projectId,
        ...(edgeIds.length ? { id: { notIn: edgeIds } } : {}),
      },
    })

    await transaction.endpointNode.deleteMany({
      where: {
        projectId,
        ...(nodeIds.length ? { id: { notIn: nodeIds } } : {}),
      },
    })

    for (const node of parsed.data.nodes) {
      await transaction.endpointNode.upsert({
        where: { id: node.id },
        update: {
          label: node.label,
          description: node.description,
          iconKind: node.icon,
          status: workspaceConverters.toEndpointStatus(node.status),
          statusReason: node.statusReason,
          category: node.category,
          x: node.position.x,
          y: node.position.y,
        },
        create: {
          id: node.id,
          label: node.label,
          description: node.description,
          iconKind: node.icon,
          status: workspaceConverters.toEndpointStatus(node.status),
          statusReason: node.statusReason,
          category: node.category,
          x: node.position.x,
          y: node.position.y,
          projectId,
        },
      })

      await transaction.apiEndpointConfig.upsert({
        where: { nodeId: node.id },
        update: {
          url: node.apiUrl ?? "https://api.example.com/endpoint",
          method: "GET",
          authType: workspaceConverters.toAuthType(node.auth),
          cadenceMin: workspaceConverters.toCadenceMinutes(node.cadence),
        },
        create: {
          nodeId: node.id,
          url: node.apiUrl ?? "https://api.example.com/endpoint",
          method: "GET",
          authType: workspaceConverters.toAuthType(node.auth),
          cadenceMin: workspaceConverters.toCadenceMinutes(node.cadence),
        },
      })

      if (node.override) {
        await transaction.nodeStatusOverride.upsert({
          where: { nodeId: node.id },
          update: {
            status: workspaceConverters.toEndpointStatus(node.override),
            reason: "Manual dashboard override",
          },
          create: {
            nodeId: node.id,
            status: workspaceConverters.toEndpointStatus(node.override),
            reason: "Manual dashboard override",
          },
        })
      } else {
        await transaction.nodeStatusOverride.deleteMany({ where: { nodeId: node.id } })
      }
    }

    for (const edge of parsed.data.edges) {
      await transaction.graphEdge.upsert({
        where: { id: edge.id },
        update: {
          label: edge.label ?? "visual link",
          sourceId: edge.source,
          targetId: edge.target,
        },
        create: {
          id: edge.id,
          label: edge.label ?? "visual link",
          sourceId: edge.source,
          targetId: edge.target,
          projectId,
        },
      })
    }
  })

  const workspace = await serializeGraphForProject(userId, projectId)
  return NextResponse.json(workspace)
}
