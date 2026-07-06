import { getPublicReportBrandImage } from "@/lib/reports"

export const dynamic = "force-dynamic"

export async function GET(_: Request, context: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await context.params
  const image = await getPublicReportBrandImage(shareToken)

  if (!image) {
    return new Response(null, { status: 404 })
  }

  return new Response(image.data, {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
