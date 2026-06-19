export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({
    value: 95,
    status: "degraded",
    source: "meridian-demo-metric",
  })
}
