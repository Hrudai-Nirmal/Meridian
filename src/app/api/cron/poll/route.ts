import { isCronAuthorized, runProjectPolling } from "@/lib/polling"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: "Unauthorized cron request" }, { status: 401 })
  }

  const result = await runProjectPolling()

  return Response.json({
    ok: true,
    mode: "secured-cron",
    result,
  })
}
