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
  const samples = await prisma.metricSample.findMany({
    where: {
      node: { projectId },
    },
    orderBy: { sampledAt: "desc" },
    include: {
      node: { select: { label: true } },
      mapping: { select: { label: true, jsonPath: true, unit: true } },
    },
  })

  const csv = toCsv(
    ["sample_id", "node", "mapping", "json_path", "value", "unit", "sampled_at"],
    samples.map((sample) => [
      sample.id,
      sample.node.label,
      sample.mapping?.label ?? "",
      sample.mapping?.jsonPath ?? "",
      sample.value,
      sample.mapping?.unit ?? "",
      sample.sampledAt.toISOString(),
    ])
  )

  return csvResponse("argusgrid-metrics.csv", csv)
}
