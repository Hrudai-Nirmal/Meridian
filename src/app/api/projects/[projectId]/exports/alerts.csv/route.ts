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
  const createdAtWhere = dateBoundsWhere(bounds.value)
  const alertsWithSentinel = await prisma.alertEvent.findMany({
    where: {
      ...(createdAtWhere ? { createdAt: createdAtWhere } : {}),
      OR: [
        { node: { projectId } },
        { rule: { projectId } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: bounds.value.limit + 1,
    include: {
      node: { select: { label: true } },
      rule: { select: { name: true } },
    },
  })
  const alerts = alertsWithSentinel.slice(0, bounds.value.limit)

  const csv = toCsv(
    ["alert_id", "title", "severity", "node", "rule", "created_at", "last_seen_at", "occurrence_count", "resolved_at", "message"],
    alerts.map((alert) => [
      alert.id,
      alert.title,
      alert.severity,
      alert.node?.label ?? "",
      alert.rule?.name ?? "",
      alert.createdAt.toISOString(),
      alert.lastSeenAt.toISOString(),
      alert.occurrenceCount,
      alert.resolvedAt?.toISOString() ?? "",
      alert.message,
    ])
  )

  return csvResponse("meridian-alerts.csv", csv, {
    rowLimit: bounds.value.limit,
    rowCount: alerts.length,
    truncated: alertsWithSentinel.length > bounds.value.limit,
  })
}
