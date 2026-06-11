import { NextResponse } from "next/server"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { getReadinessStatus } from "@/lib/health"
import { runProjectPolling } from "@/lib/polling"
import { serializeGraphForProject } from "@/lib/workspace"

export const dynamic = "force-dynamic"

export async function POST(_: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const result = await runProjectPolling({ projectId })
  const [diagnostics, workspace] = await Promise.all([getReadinessStatus(), serializeGraphForProject(userId, projectId)])

  return NextResponse.json({
    ok: true,
    result,
    diagnostics,
    alerts: workspace?.alerts ?? [],
    nodes: workspace?.nodes ?? [],
  })
}
