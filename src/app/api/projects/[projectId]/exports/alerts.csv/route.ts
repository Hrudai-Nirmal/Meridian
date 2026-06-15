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
  const alerts = await prisma.alertEvent.findMany({
    where: {
      OR: [
        { node: { projectId } },
        { rule: { projectId } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      node: { select: { label: true } },
      rule: { select: { name: true } },
    },
  })

  const csv = toCsv(
    ["alert_id", "title", "severity", "node", "rule", "created_at", "resolved_at", "message"],
    alerts.map((alert) => [
      alert.id,
      alert.title,
      alert.severity,
      alert.node?.label ?? "",
      alert.rule?.name ?? "",
      alert.createdAt.toISOString(),
      alert.resolvedAt?.toISOString() ?? "",
      alert.message,
    ])
  )

  return csvResponse("argusgrid-alerts.csv", csv)
}
