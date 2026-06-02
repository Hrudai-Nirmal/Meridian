import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId } from "@/lib/api-session"
import { getPrisma } from "@/lib/prisma"
import { assertProjectAccess, serializeGraphForProject, slugify } from "@/lib/workspace"

const updateProjectSchema = z.object({
  name: z.string().min(2).max(80),
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
  await assertProjectAccess(userId, projectId)
  const parsed = updateProjectSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()
  await prisma.project.update({
    where: { id: projectId },
    data: {
      name: parsed.data.name,
      slug: `${slugify(parsed.data.name)}-${projectId.slice(-5)}`,
    },
  })

  const workspace = await serializeGraphForProject(userId, projectId)
  return NextResponse.json(workspace)
}

export async function DELETE(_: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  await assertProjectAccess(userId, projectId)

  const prisma = getPrisma()
  await prisma.project.update({
    where: { id: projectId },
    data: { archivedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
