import { getReadinessStatus } from "@/lib/health"

export const dynamic = "force-dynamic"

export async function GET() {
  const status = await getReadinessStatus()
  return Response.json(status, { status: status.ok ? 200 : 503 })
}
