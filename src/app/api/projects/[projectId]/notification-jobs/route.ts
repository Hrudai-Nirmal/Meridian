/**
 * Bounded, secret-safe notification job listing for project operators.
 */
import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { NOTIFICATION_JOB_STATUSES, serializeNotificationJob } from "@/lib/notification-jobs"
import { getPrisma } from "@/lib/prisma"
import { dateBoundsWhere, parseBoundedQuery } from "@/lib/query-limits"

const querySchema = z.object({ status: z.enum(NOTIFICATION_JOB_STATUSES).optional() })

/** Returns recent jobs and queue-health counts for one project. */
export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error
  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId, ["OWNER", "ADMIN", "MEMBER", "VIEWER"])
  if (accessError) return accessError

  const url = new URL(request.url)
  const parsed = querySchema.safeParse({ status: url.searchParams.get("status")?.toUpperCase() || undefined })
  if (!parsed.success) return NextResponse.json({ error: "Invalid notification job status." }, { status: 400 })
  const bounds = parseBoundedQuery(url.searchParams, { defaultLimit: 25, maxLimit: 100, defaultWindow: "30d" })
  if (!bounds.ok) return NextResponse.json({ error: bounds.error }, { status: 400 })

  const prisma = getPrisma()
  const createdAtWhere = dateBoundsWhere(bounds.value)
  const [jobs, groupedCounts] = await Promise.all([
    prisma.notificationJob.findMany({
      where: { projectId, ...(createdAtWhere ? { createdAt: createdAtWhere } : {}), ...(parsed.data.status ? { status: parsed.data.status } : {}) },
      orderBy: { createdAt: "desc" },
      take: bounds.value.limit,
    }),
    prisma.notificationJob.groupBy({ where: { projectId }, by: ["status"], _count: { _all: true } }),
  ])

  return NextResponse.json({
    jobs: jobs.map(serializeNotificationJob),
    counts: Object.fromEntries(groupedCounts.map((item) => [item.status, item._count._all])),
    meta: { limit: bounds.value.limit, returned: jobs.length },
  })
}
