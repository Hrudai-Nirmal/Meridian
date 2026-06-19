import "server-only"

import { getAppBuildMetadata, type AppBuildMetadata } from "@/lib/app-version"
import { hasGithubAuthConfig } from "@/lib/auth"
import { isEmailConfigured } from "@/lib/notifications"
import { getDatabaseConnectionSource, getPrisma, hasDatabaseConfig } from "@/lib/prisma"
import { logServerError } from "@/lib/server-logging"

export type ReadinessIssue = {
  code: string
  component: "database" | "health"
  message: string
  incidentId: string | null
}

export type ReadinessStatus = {
  ok: boolean
  checkedAt: string
  build: AppBuildMetadata
  checks: {
    database: boolean
    auth: boolean
    encryption: boolean
    cron: boolean
    email: boolean
    jobs: boolean
  }
  latestPoll: {
    status: string
    startedAt: string
    finishedAt: string | null
    durationMs: number | null
    sampledNodes: number
    createdSamples: number
    evaluatedAlerts: number
    rollupsQueued: number
    deletedSamples: number
    errorSummary: string | null
  } | null
  latestEmail: {
    status: string
    provider: string
    attemptedAt: string
    sentAt: string | null
  } | null
  notificationJobs: Record<string, number>
  issues: ReadinessIssue[]
}

/**
 * Returns secret-safe deployment and dependency readiness details.
 */
export async function getReadinessStatus(): Promise<ReadinessStatus> {
  const databaseConfigured = hasDatabaseConfig()
  const checks = {
    database: false,
    auth: Boolean(process.env.NEXTAUTH_URL && process.env.NEXTAUTH_SECRET && hasGithubAuthConfig()),
    encryption: Boolean(process.env.ENCRYPTION_KEY),
    cron: Boolean(process.env.CRON_SECRET),
    email: isEmailConfigured(),
    jobs: Boolean(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY),
  }
  let latestPoll: ReadinessStatus["latestPoll"] = null
  let latestEmail: ReadinessStatus["latestEmail"] = null
  let notificationJobs: ReadinessStatus["notificationJobs"] = {}
  const issues: ReadinessIssue[] = []

  if (databaseConfigured) {
    try {
      const prisma = getPrisma()
      await prisma.$queryRaw`SELECT 1`
      checks.database = true
      const [poll, delivery, groupedJobs] = await Promise.all([
        prisma.pollExecution.findFirst({ orderBy: { startedAt: "desc" } }),
        prisma.alertNotificationDelivery.findFirst({
          orderBy: { attemptedAt: "desc" },
          select: { status: true, provider: true, attemptedAt: true, sentAt: true },
        }),
        prisma.notificationJob.groupBy({ by: ["status"], _count: { _all: true } }),
      ])
      notificationJobs = Object.fromEntries(groupedJobs.map((item) => [item.status, item._count._all]))

      latestPoll = poll
        ? {
            status: poll.status,
            startedAt: poll.startedAt.toISOString(),
            finishedAt: poll.finishedAt?.toISOString() ?? null,
            durationMs: poll.durationMs,
            sampledNodes: poll.sampledNodes,
            createdSamples: poll.createdSamples,
            evaluatedAlerts: poll.evaluatedAlerts,
            rollupsQueued: poll.rollupsQueued,
            deletedSamples: poll.deletedSamples,
            errorSummary: poll.errorSummary,
          }
        : null
      latestEmail = delivery
        ? {
            status: delivery.status,
            provider: delivery.provider,
            attemptedAt: delivery.attemptedAt.toISOString(),
            sentAt: delivery.sentAt?.toISOString() ?? null,
          }
        : null
    } catch (error) {
      checks.database = false
      const incident = logServerError("health.database_check_failed", error, {
        component: "database",
        connectionSource: getDatabaseConnectionSource(),
      })
      issues.push({
        code: incident.errorCode,
        component: "database",
        message: "The database is temporarily unavailable.",
        incidentId: incident.incidentId,
      })
    }
  } else {
    issues.push({
      code: "DATABASE_NOT_CONFIGURED",
      component: "database",
      message: "A database connection is not configured.",
      incidentId: null,
    })
  }

  if (!checks.jobs) {
    issues.push({
      code: "DURABLE_JOBS_NOT_CONFIGURED",
      component: "health",
      message: "Inngest event and signing keys are not configured.",
      incidentId: null,
    })
  }

  return {
    ok: Object.values(checks).every(Boolean),
    checkedAt: new Date().toISOString(),
    build: getAppBuildMetadata(),
    checks,
    latestPoll,
    latestEmail,
    notificationJobs,
    issues,
  }
}
