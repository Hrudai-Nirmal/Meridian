import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId } from "@/lib/api-session"
import { createBlankProject, createSeedProject, getWorkspaceForUser } from "@/lib/workspace"

const createProjectSchema = z.object({
  name: z.string().min(2).max(80),
  mode: z.enum(["blank", "demo"]).default("blank"),
})

export async function GET() {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const workspace = await getWorkspaceForUser(userId)

  return NextResponse.json({
    organization: workspace?.organization ?? null,
    projects: workspace?.projects ?? [],
    activeProjectId: workspace?.project.id ?? null,
  })
}

export async function POST(request: Request) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const parsed = createProjectSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const workspace = await getWorkspaceForUser(userId)
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 })
  }

  const project =
    parsed.data.mode === "demo"
      ? await createSeedProject(workspace.organization.id, parsed.data.name)
      : await createBlankProject(workspace.organization.id, parsed.data.name)

  return NextResponse.json({ project }, { status: 201 })
}
