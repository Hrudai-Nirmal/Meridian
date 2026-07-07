/**
 * Meridian JavaScript SDK preview.
 *
 * The SDK keeps telemetry best-effort by default so monitoring outages do not
 * break a customer's automation, while still allowing scripts to flush pending
 * deliveries before exit.
 */
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
  timeoutMs?: number
  onError?: (error: unknown) => void
}

export type TraceOptions = {
  nodeId: string
  name?: string
  externalId?: string
  costUsd?: number
  tokens?: number
}

const DEFAULT_BASE_URL = "https://meridian.hrudainirmal.in"
const DEFAULT_TIMEOUT_MS = 5000
const VALID_STATUSES = new Set<MeridianRunStatus>(["success", "degraded", "failed", "running", "queued"])

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Meridian ${fieldName} is required.`)
  }
}

function assertPlainObject(value: unknown, fieldName: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Meridian ${fieldName} must be an object.`)
  }
}

function normalizeBaseUrl(baseUrl: string) {
  try {
    const parsedUrl = new URL(baseUrl)
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error("Unsupported protocol.")
    }
    return parsedUrl.toString().replace(/\/$/, "")
  } catch {
    throw new Error("Meridian baseUrl must be a valid HTTP(S) URL.")
  }
}

function normalizeTimeoutMs(timeoutMs: number | undefined) {
  if (timeoutMs === undefined) return DEFAULT_TIMEOUT_MS
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Meridian timeoutMs must be a positive number.")
  }
  return timeoutMs
}

function validateRunPayload(payload: MeridianRunPayload) {
  assertPlainObject(payload, "run payload")
  assertNonEmptyString(payload.nodeId, "nodeId")
  assertNonEmptyString(payload.startedAt, "startedAt")

  if (!VALID_STATUSES.has(payload.status)) {
    throw new Error("Meridian status must be one of success, degraded, failed, running, or queued.")
  }

  if (payload.steps && payload.steps.length > 100) {
    throw new Error("Meridian steps cannot contain more than 100 items.")
  }
}

function createTimeoutError(timeoutMs: number) {
  return new Error(`Meridian ingestion timed out after ${timeoutMs}ms.`)
}

/** Creates a Meridian telemetry client for run ingestion and tracing. */
export function createMeridian(options: MeridianClientOptions) {
  assertPlainObject(options, "client options")
  assertNonEmptyString(options.token, "token")

  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL)
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs)
  const activeDeliveries = new Set<Promise<void>>()

  /** Sends one workflow run payload to Meridian. */
  async function ingestRun(payload: MeridianRunPayload) {
    validateRunPayload(payload)

    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(createTimeoutError(timeoutMs)), timeoutMs)

    try {
      const response = await fetch(`${baseUrl}/api/ingest/runs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`Meridian ingestion failed with HTTP ${response.status}`)
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        throw createTimeoutError(timeoutMs)
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  function reportDeliveryError(error: unknown) {
    if (options.onError) {
      try {
        options.onError(error)
      } catch {
        // User observability hooks must not make best-effort telemetry blocking.
      }
      return
    }
    console.warn("Meridian telemetry delivery failed.", error)
  }

  function trackDelivery(payload: MeridianRunPayload) {
    const delivery = ingestRun(payload).catch(reportDeliveryError)
    activeDeliveries.add(delivery)
    delivery.finally(() => {
      activeDeliveries.delete(delivery)
    })
    return delivery
  }

  /** Decorates an operation and records one best-effort run after it settles. */
  async function trace<T>(traceOptions: TraceOptions, operation: () => Promise<T> | T): Promise<T> {
    assertNonEmptyString(traceOptions.nodeId, "nodeId")

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

      trackDelivery(payload)
    }
  }

  /** Waits for currently pending best-effort deliveries to settle. */
  async function flush() {
    await Promise.all(Array.from(activeDeliveries))
  }

  return { ingestRun, trace, flush }
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
