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

function getUnconfiguredWorkerResponse() {
  return Response.json({ error: "Durable jobs are not configured." }, { status: 503 })
}

/** Allows function discovery only after production signing is configured. */
export function GET(request: NextRequest, context: Parameters<typeof handlers.GET>[1]) {
  if (!isProductionWorkerConfigured()) return getUnconfiguredWorkerResponse()
  return handlers.GET(request, context)
}

/** Rejects worker execution until production signing is configured, then delegates signature verification to Inngest. */
export function POST(request: NextRequest, context: Parameters<typeof handlers.POST>[1]) {
  if (!isProductionWorkerConfigured()) return getUnconfiguredWorkerResponse()
  return handlers.POST(request, context)
}

/** Rejects production sync without signing configuration. */
export function PUT(request: NextRequest, context: Parameters<typeof handlers.PUT>[1]) {
  if (!isProductionWorkerConfigured()) return getUnconfiguredWorkerResponse()
  return handlers.PUT(request, context)
}
