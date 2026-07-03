import { isCronAuthorized, runProjectPolling } from "@/lib/polling"
import { canRunCronPolling, getRuntimeEnvironment } from "@/lib/runtime-environment"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: "Unauthorized cron request" }, { status: 401 })
  }
  if (!canRunCronPolling()) {
    return Response.json({
      error: "Cron polling is disabled in this runtime.",
      runtime: getRuntimeEnvironment().label,
    }, { status: 403 })
  }

  const result = await runProjectPolling()

  return Response.json({
    ok: true,
    mode: "secured-cron",
    result,
  })
}
