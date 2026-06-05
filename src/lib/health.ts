import "server-only"

import { hasGithubAuthConfig } from "@/lib/auth"
import { getPrisma, hasDatabaseConfig } from "@/lib/prisma"

export type ReadinessStatus = {
  ok: boolean
  checkedAt: string
  checks: {
    database: boolean
    auth: boolean
    encryption: boolean
    cron: boolean
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
}

export async function getReadinessStatus(): Promise<ReadinessStatus> {
  const databaseConfigured = hasDatabaseConfig()
  const checks = {
    database: false,
    auth: Boolean(process.env.NEXTAUTH_URL && process.env.NEXTAUTH_SECRET && hasGithubAuthConfig()),
    encryption: Boolean(process.env.ENCRYPTION_KEY),
    cron: Boolean(process.env.CRON_SECRET),
  }
  let latestPoll: ReadinessStatus["latestPoll"] = null

  if (databaseConfigured) {
    try {
      const prisma = getPrisma()
      await prisma.$queryRaw`SELECT 1`
      checks.database = true
      const poll = await prisma.pollExecution.findFirst({
        orderBy: { startedAt: "desc" },
      })

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
    } catch {
      checks.database = false
    }
  }

  return {
    ok: Object.values(checks).every(Boolean),
    checkedAt: new Date().toISOString(),
    checks,
    latestPoll,
  }
}
