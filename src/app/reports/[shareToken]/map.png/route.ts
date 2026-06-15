import { getPublicReportMapImage } from "@/lib/reports"

export const dynamic = "force-dynamic"

export async function GET(_: Request, context: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await context.params
  const image = await getPublicReportMapImage(shareToken)

  if (!image) {
    return new Response(null, { status: 404 })
  }

  return new Response(image.data, {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "private, no-store",
    },
  })
}
