import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { csvResponse, toCsv } from "@/lib/csv"
import { getPrisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(_: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN"])
  if (accessError) return accessError

  const prisma = getPrisma()
  const runs = await prisma.workflowRun.findMany({
    where: {
      node: { projectId },
    },
    orderBy: { startedAt: "desc" },
    include: {
      node: { select: { label: true } },
      steps: true,
    },
  })

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

  return csvResponse("argusgrid-runs.csv", csv)
}
