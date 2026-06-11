export type ArgusGridRunStatus = "success" | "degraded" | "failed" | "running" | "queued"

export type ArgusGridStep = {
  name: string
  status: ArgusGridRunStatus
  latencyMs?: number
  toolName?: string
}

export type ArgusGridRunPayload = {
  nodeId: string
  externalId?: string
  status: ArgusGridRunStatus
  startedAt: string
  finishedAt?: string
  costUsd?: number
  tokens?: number
  steps?: ArgusGridStep[]
}

export type ArgusGridClientOptions = {
  token: string
  baseUrl?: string
}

export type TraceOptions = {
  nodeId: string
  name?: string
  externalId?: string
  costUsd?: number
  tokens?: number
}

export function createArgusGrid(options: ArgusGridClientOptions) {
  const baseUrl = (options.baseUrl ?? "https://argusgrid.hrudainirmal.in").replace(/\/$/, "")

  async function ingestRun(payload: ArgusGridRunPayload) {
    const response = await fetch(`${baseUrl}/api/ingest/runs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`ArgusGrid ingestion failed with HTTP ${response.status}`)
    }
  }

  async function trace<T>(traceOptions: TraceOptions, operation: () => Promise<T> | T): Promise<T> {
    const startedAt = new Date().toISOString()
    const started = performance.now()
    let status: ArgusGridRunStatus = "success"

    try {
      return await operation()
    } catch (error) {
      status = "failed"
      throw error
    } finally {
      const latencyMs = Math.round(performance.now() - started)
      const payload: ArgusGridRunPayload = {
        nodeId: traceOptions.nodeId,
        externalId: traceOptions.externalId,
        status,
        startedAt,
        finishedAt: new Date().toISOString(),
        costUsd: traceOptions.costUsd,
        tokens: traceOptions.tokens,
        steps: [
          {
            name: traceOptions.name ?? "JavaScript operation",
            status,
            latencyMs,
            toolName: "js-sdk",
          },
        ],
      }

      ingestRun(payload).catch(() => undefined)
    }
  }

  return { ingestRun, trace }
}
