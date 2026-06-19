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
  const sampledAtWhere = dateBoundsWhere(bounds.value)
  const samplesWithSentinel = await prisma.metricSample.findMany({
    where: {
      ...(sampledAtWhere ? { sampledAt: sampledAtWhere } : {}),
      node: { projectId },
    },
    orderBy: { sampledAt: "desc" },
    take: bounds.value.limit + 1,
    include: {
      node: { select: { label: true } },
      mapping: { select: { label: true, jsonPath: true, unit: true } },
    },
  })
  const samples = samplesWithSentinel.slice(0, bounds.value.limit)

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

  return csvResponse("meridian-metrics.csv", csv, {
    rowLimit: bounds.value.limit,
    rowCount: samples.length,
    truncated: samplesWithSentinel.length > bounds.value.limit,
  })
}
