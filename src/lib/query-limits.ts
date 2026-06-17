/**
 * Shared bounded query parsing for enterprise-safe list and export routes.
 */

export type QueryWindow = "24h" | "7d" | "30d" | "all"

export type BoundedQueryOptions = {
  defaultLimit: number
  maxLimit: number
  defaultWindow: QueryWindow
}

export type BoundedQuery = {
  limit: number
  window: QueryWindow
  start: Date | null
  end: Date | null
}

export type BoundedQueryResult = { ok: true; value: BoundedQuery } | { ok: false; error: string }

const WINDOW_DAYS: Record<Exclude<QueryWindow, "all">, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
}

const WINDOWS = new Set<QueryWindow>(["24h", "7d", "30d", "all"])

function parseLimit(value: string | null, options: BoundedQueryOptions) {
  if (!value) return options.defaultLimit
  if (!/^\d+$/.test(value)) return null
  const limit = Number(value)
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > options.maxLimit) return null
  return limit
}

function parseDate(value: string | null, name: string) {
  if (!value) return { ok: true as const, value: null }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false as const, error: `${name} must be a valid date.` }
  }
  return { ok: true as const, value: parsed }
}

function getWindowStart(window: QueryWindow) {
  if (window === "all") return null
  return new Date(Date.now() - WINDOW_DAYS[window] * 24 * 60 * 60 * 1000)
}

/**
 * Parses `limit`, `window`, `start`, and `end` into safe query bounds.
 */
export function parseBoundedQuery(searchParams: URLSearchParams, options: BoundedQueryOptions): BoundedQueryResult {
  const rawWindow = searchParams.get("window") ?? options.defaultWindow
  if (!WINDOWS.has(rawWindow as QueryWindow)) {
    return { ok: false, error: "window must be one of 24h, 7d, 30d, or all." }
  }

  const limit = parseLimit(searchParams.get("limit"), options)
  if (!limit) {
    return { ok: false, error: `limit must be an integer between 1 and ${options.maxLimit}.` }
  }

  const parsedStart = parseDate(searchParams.get("start"), "start")
  if (!parsedStart.ok) return { ok: false, error: parsedStart.error }

  const parsedEnd = parseDate(searchParams.get("end"), "end")
  if (!parsedEnd.ok) return { ok: false, error: parsedEnd.error }

  const hasExplicitRange = Boolean(parsedStart.value || parsedEnd.value)
  const start = hasExplicitRange ? parsedStart.value : getWindowStart(rawWindow as QueryWindow)
  const end = parsedEnd.value

  if (start && end && end.getTime() < start.getTime()) {
    return { ok: false, error: "end must be after start." }
  }

  return {
    ok: true,
    value: {
      limit,
      window: rawWindow as QueryWindow,
      start,
      end,
    },
  }
}

/**
 * Converts parsed bounds into a Prisma date field filter.
 */
export function dateBoundsWhere(bounds: Pick<BoundedQuery, "start" | "end">) {
  if (!bounds.start && !bounds.end) return undefined
  return {
    ...(bounds.start ? { gte: bounds.start } : {}),
    ...(bounds.end ? { lte: bounds.end } : {}),
  }
}
