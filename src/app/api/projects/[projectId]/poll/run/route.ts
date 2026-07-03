import { NextResponse } from "next/server"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { createAuditLog } from "@/lib/audit-log"
import { getPrisma } from "@/lib/prisma"
import { getReadinessStatus } from "@/lib/health"
import { runProjectPolling } from "@/lib/polling"
import { canUseExternalSideEffects, getRuntimeEnvironment } from "@/lib/runtime-environment"
import { serializeGraphForProject } from "@/lib/workspace"

export const dynamic = "force-dynamic"

export async function POST(_: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError
  if (!canUseExternalSideEffects()) {
    return NextResponse.json({
      error: "Manual polling is disabled in this runtime.",
      runtime: getRuntimeEnvironment().label,
    }, { status: 403 })
  }

  const result = await runProjectPolling({ projectId, force: true })
  const [diagnostics, workspace] = await Promise.all([getReadinessStatus(), serializeGraphForProject(userId, projectId)])
  await createAuditLog(getPrisma(), {
    action: "poll.manual",
    entity: "poll",
    entityId: projectId,
    projectId,
    userId,
    metadata: { checkedAt: result.checkedAt, status: result.status, sampledNodes: result.sampledNodes, createdSamples: result.createdSamples },
  })

  return NextResponse.json({
    ok: true,
    result,
    diagnostics,
    alerts: workspace?.alerts ?? [],
    nodes: workspace?.nodes ?? [],
  })
}
