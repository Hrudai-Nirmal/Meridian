import { NextResponse } from "next/server"

import { getApiUserId } from "@/lib/api-session"
import { serializeGraphForProject } from "@/lib/workspace"

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
