import { getReadinessStatus } from "@/lib/health"
import { getAppBuildMetadata } from "@/lib/app-version"
import { getRuntimeEnvironment } from "@/lib/runtime-environment"
import { logServerError } from "@/lib/server-logging"

export const dynamic = "force-dynamic"

/**
 * Returns secret-safe application readiness and incident metadata.
 */
export async function GET() {
  try {
    const status = await getReadinessStatus()
    return Response.json(status, { status: status.ok ? 200 : 503 })
  } catch (error) {
    const incident = logServerError("health.route_failed", error, { component: "health" })
    return Response.json({
      ok: false,
      checkedAt: new Date().toISOString(),
      build: getAppBuildMetadata(),
      runtime: getRuntimeEnvironment(),
      checks: { database: false, schema: false, auth: false, encryption: false, cron: false, email: false, jobs: false },
      latestPoll: null,
      latestEmail: null,
      notificationJobs: {},
      issues: [{
        code: "HEALTH_CHECK_FAILED",
        component: "health",
        message: "Readiness checks could not be completed.",
        incidentId: incident.incidentId,
      }],
      warnings: [],
    }, { status: 503 })
  }
}
