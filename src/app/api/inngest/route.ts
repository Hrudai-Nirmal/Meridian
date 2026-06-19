/**
 * Signed Inngest function discovery and execution endpoint.
 */
import { serve } from "inngest/next"
import type { NextRequest } from "next/server"

import { inngest } from "@/inngest/client"
import { processNotificationJob, recoverQueuedNotifications } from "@/inngest/functions"

export const maxDuration = 60

const handlers = serve({
  client: inngest,
  functions: [processNotificationJob, recoverQueuedNotifications],
})

function isProductionWorkerConfigured() {
  return process.env.NODE_ENV !== "production" || Boolean(process.env.INNGEST_SIGNING_KEY)
}

/** Allows function discovery while rejecting production execution without signing configuration. */
export const GET = handlers.GET

/** Rejects worker execution until production signing is configured, then delegates signature verification to Inngest. */
export async function POST(request: NextRequest, context: Parameters<typeof handlers.POST>[1]) {
  if (!isProductionWorkerConfigured()) return Response.json({ error: "Durable jobs are not configured." }, { status: 503 })
  return handlers.POST(request, context)
}

/** Rejects production sync without signing configuration. */
export async function PUT(request: NextRequest, context: Parameters<typeof handlers.PUT>[1]) {
  if (!isProductionWorkerConfigured()) return Response.json({ error: "Durable jobs are not configured." }, { status: 503 })
  return handlers.PUT(request, context)
}
