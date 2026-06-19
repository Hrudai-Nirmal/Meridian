export type MeridianRunStatus = "success" | "degraded" | "failed" | "running" | "queued"

export type MeridianStep = {
  name: string
  status: MeridianRunStatus
  latencyMs?: number
  toolName?: string
}

export type MeridianRunPayload = {
  nodeId: string
  externalId?: string
  status: MeridianRunStatus
  startedAt: string
  finishedAt?: string
  costUsd?: number
  tokens?: number
  steps?: MeridianStep[]
}

export type MeridianClientOptions = {
  token: string
  baseUrl?: string
  onError?: (error: unknown) => void
}

export type TraceOptions = {
  nodeId: string
  name?: string
  externalId?: string
  costUsd?: number
  tokens?: number
}

/** Creates a Meridian telemetry client for run ingestion and tracing. */
export function createMeridian(options: MeridianClientOptions) {
  const baseUrl = (options.baseUrl ?? "https://meridian.hrudainirmal.in").replace(/\/$/, "")

  async function ingestRun(payload: MeridianRunPayload) {
    const response = await fetch(`${baseUrl}/api/ingest/runs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Meridian ingestion failed with HTTP ${response.status}`)
    }
  }

  async function trace<T>(traceOptions: TraceOptions, operation: () => Promise<T> | T): Promise<T> {
    const startedAt = new Date().toISOString()
    const started = performance.now()
    let status: MeridianRunStatus = "success"

    try {
      return await operation()
    } catch (error) {
      status = "failed"
      throw error
    } finally {
      const latencyMs = Math.round(performance.now() - started)
      const payload: MeridianRunPayload = {
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

      ingestRun(payload).catch((error: unknown) => {
        if (options.onError) {
          options.onError(error)
          return
        }
        console.warn("Meridian telemetry delivery failed.", error)
      })
    }
  }

  return { ingestRun, trace }
}

/** @deprecated Use MeridianRunStatus. */
export type ArgusGridRunStatus = MeridianRunStatus
/** @deprecated Use MeridianStep. */
export type ArgusGridStep = MeridianStep
/** @deprecated Use MeridianRunPayload. */
export type ArgusGridRunPayload = MeridianRunPayload
/** @deprecated Use MeridianClientOptions. */
export type ArgusGridClientOptions = MeridianClientOptions
/** @deprecated Use createMeridian. */
export const createArgusGrid = createMeridian
