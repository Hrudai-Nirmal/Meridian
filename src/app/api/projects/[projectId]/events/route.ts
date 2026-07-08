import { NextResponse } from "next/server"

import { getApiUserId } from "@/lib/api-session"
import { diffProjectLiveAreas, getProjectLiveSnapshot, type ProjectLiveArea, type ProjectLiveSnapshot } from "@/lib/project-live"
import { assertProjectAccess } from "@/lib/workspace"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

// A live signal does not need dashboard-grade polling frequency; this keeps idle tabs inexpensive.
const CHECK_INTERVAL_MS = 20_000
const STREAM_TTL_MS = 28_000

type LiveEventType = "connected" | "heartbeat" | "refresh"

type LiveEventPayload = {
  type: LiveEventType
  projectId: string
  cursor: string
  changed: ProjectLiveArea[]
  checkedAt: string
}

function encodeEvent(event: LiveEventType, payload: LiveEventPayload) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
}

function payloadFor(type: LiveEventType, projectId: string, snapshot: ProjectLiveSnapshot, changed: ProjectLiveArea[] = []): LiveEventPayload {
  return {
    type,
    projectId,
    cursor: snapshot.cursor,
    changed,
    checkedAt: snapshot.checkedAt,
  }
}

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params

  try {
    await assertProjectAccess(userId, projectId)
  } catch {
    return NextResponse.json({ error: "Project live access denied." }, { status: 403 })
  }

  const initialSnapshot = await getProjectLiveSnapshot(projectId)
  const encoder = new TextEncoder()
  let previousSnapshot = initialSnapshot
  let interval: ReturnType<typeof setInterval> | null = null
  let timeout: ReturnType<typeof setTimeout> | null = null
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        if (closed) return
        closed = true
        if (interval) clearInterval(interval)
        if (timeout) clearTimeout(timeout)
        controller.close()
      }
      const send = (event: LiveEventType, payload: LiveEventPayload) => {
        if (closed) return
        controller.enqueue(encoder.encode(encodeEvent(event, payload)))
      }

      send("connected", payloadFor("connected", projectId, initialSnapshot))

      interval = setInterval(() => {
        if (request.signal.aborted) {
          close()
          return
        }

        getProjectLiveSnapshot(projectId)
          .then((snapshot) => {
            const changed = diffProjectLiveAreas(previousSnapshot, snapshot)
            previousSnapshot = snapshot
            send(changed.length ? "refresh" : "heartbeat", payloadFor(changed.length ? "refresh" : "heartbeat", projectId, snapshot, changed))
          })
          .catch(() => {
            send("heartbeat", payloadFor("heartbeat", projectId, previousSnapshot))
          })
      }, CHECK_INTERVAL_MS)

      timeout = setTimeout(() => {
        send("heartbeat", payloadFor("heartbeat", projectId, previousSnapshot))
        close()
      }, STREAM_TTL_MS)

      request.signal.addEventListener("abort", close, { once: true })
    },
    cancel() {
      closed = true
      if (interval) clearInterval(interval)
      if (timeout) clearTimeout(timeout)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
