import { NextResponse } from "next/server"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { getPrisma } from "@/lib/prisma"
import { assertProjectAccess } from "@/lib/workspace"

const ALLOWED_ICON_TYPES = new Set(["image/png", "image/svg+xml"])
const MAX_ICON_BYTES = 64 * 1024

export async function GET(_: Request, context: { params: Promise<{ projectId: string; nodeId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, nodeId } = await context.params
  await assertProjectAccess(userId, projectId)

  const prisma = getPrisma()
  const node = await prisma.endpointNode.findFirst({
    where: { id: nodeId, projectId },
    include: { icon: true },
  })

  if (!node?.icon) {
    return NextResponse.json({ error: "Icon not found." }, { status: 404 })
  }

  return new Response(node.icon.data, {
    headers: {
      "Content-Type": node.icon.mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  })
}

export async function PUT(request: Request, context: { params: Promise<{ projectId: string; nodeId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, nodeId } = await context.params
  const accessError = await requireProjectRole(userId, projectId)
  if (accessError) return accessError

  const formData = await request.formData()
  const file = formData.get("icon")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload an icon file." }, { status: 400 })
  }

  if (!ALLOWED_ICON_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Icons must be PNG or SVG." }, { status: 400 })
  }

  if (file.size > MAX_ICON_BYTES) {
    return NextResponse.json({ error: "Icons must be 64 KB or smaller." }, { status: 400 })
  }

  const prisma = getPrisma()
  const node = await prisma.endpointNode.findFirst({ where: { id: nodeId, projectId }, select: { id: true } })
  if (!node) {
    return NextResponse.json({ error: "Node not found." }, { status: 404 })
  }

  const icon = await prisma.nodeIcon.create({
    data: {
      name: file.name.slice(0, 80) || "Custom icon",
      mimeType: file.type,
      data: Buffer.from(await file.arrayBuffer()),
    },
  })

  await prisma.endpointNode.update({
    where: { id: nodeId },
    data: { iconId: icon.id },
  })

  return NextResponse.json({
    ok: true,
    iconUrl: `/api/projects/${projectId}/nodes/${nodeId}/icon?v=${Date.now()}`,
  })
}
