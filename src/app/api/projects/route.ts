import { NextResponse } from "next/server"

import { getApiUserId } from "@/lib/api-session"
import { getWorkspaceForUser } from "@/lib/workspace"

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
