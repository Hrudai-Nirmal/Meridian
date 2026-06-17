import { NextResponse } from "next/server"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { csvResponse, toCsv } from "@/lib/csv"
import { getPrisma } from "@/lib/prisma"
import { dateBoundsWhere, parseBoundedQuery } from "@/lib/query-limits"

export const dynamic = "force-dynamic"

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const bounds = parseBoundedQuery(new URL(request.url).searchParams, {
    defaultLimit: 5000,
    maxLimit: 10000,
    defaultWindow: "30d",
  })
  if (!bounds.ok) {
    return NextResponse.json({ error: bounds.error }, { status: 400 })
  }

  const prisma = getPrisma()
  const startedAtWhere = dateBoundsWhere(bounds.value)
  const runsWithSentinel = await prisma.workflowRun.findMany({
    where: {
      ...(startedAtWhere ? { startedAt: startedAtWhere } : {}),
      node: { projectId },
    },
    orderBy: { startedAt: "desc" },
    take: bounds.value.limit + 1,
    include: {
      node: { select: { label: true } },
      steps: true,
    },
  })
  const runs = runsWithSentinel.slice(0, bounds.value.limit)

  const csv = toCsv(
    ["run_id", "external_id", "node", "status", "started_at", "finished_at", "cost_usd", "tokens", "step_count"],
    runs.map((run) => [
      run.id,
      run.externalId,
      run.node.label,
      run.status,
      run.startedAt.toISOString(),
      run.finishedAt?.toISOString() ?? "",
      run.costUsd?.toString() ?? "",
      run.tokens ?? "",
      run.steps.length,
    ])
  )

  return csvResponse("argusgrid-runs.csv", csv, {
    rowLimit: bounds.value.limit,
    rowCount: runs.length,
    truncated: runsWithSentinel.length > bounds.value.limit,
  })
}
