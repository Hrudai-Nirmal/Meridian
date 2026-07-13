/**
 * Report period helpers are shared by authenticated report creation and public
 * report rendering so comparisons use the same range math everywhere.
 */

const WINDOW_DAYS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
}

function parseDate(value, name) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""))
  if (!Number.isFinite(date.getTime())) throw new Error(`${name} must be a valid date.`)
  return date
}

function previousRange(start, end) {
  const durationMs = end.getTime() - start.getTime()
  return {
    start: new Date(start.getTime() - durationMs),
    end: new Date(start.getTime()),
  }
}

/**
 * Resolves user-facing period controls into current and previous query ranges.
 *
 * @param {{ mode?: string, window?: string | null, start?: string | Date | null, end?: string | Date | null, comparisonEnabled?: boolean, now?: Date }} input
 */
export function resolveReportPeriod(input = {}) {
  const now = input.now ?? new Date()
  const mode = input.mode === "custom" || input.mode === "all" ? input.mode : "window"

  if (mode === "all") {
    return {
      mode: "all",
      window: null,
      start: null,
      end: null,
      comparisonEnabled: false,
      previous: null,
    }
  }

  if (mode === "custom") {
    const start = parseDate(input.start, "periodStart")
    const end = parseDate(input.end, "periodEnd")
    if (end.getTime() <= start.getTime()) throw new Error("Period end must be after start.")
    const comparisonEnabled = Boolean(input.comparisonEnabled)
    return {
      mode,
      window: null,
      start,
      end,
      comparisonEnabled,
      previous: comparisonEnabled ? previousRange(start, end) : null,
    }
  }

  const window = Object.hasOwn(WINDOW_DAYS, input.window) ? input.window : "30d"
  const durationMs = WINDOW_DAYS[window] * 24 * 60 * 60 * 1000
  const start = new Date(now.getTime() - durationMs)
  const end = new Date(now.getTime())
  const comparisonEnabled = Boolean(input.comparisonEnabled)
  return {
    mode: "window",
    window,
    start,
    end,
    comparisonEnabled,
    previous: comparisonEnabled ? previousRange(start, end) : null,
  }
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

/**
 * Formats a resolved period for client-ready reports.
 *
 * @param {ReturnType<typeof resolveReportPeriod>} period
 */
export function formatReportPeriodLabel(period) {
  if (period.mode === "all") return "All available data"
  if (period.mode === "window") return `Last ${period.window?.replace("d", " days") ?? "30 days"}`
  return `${formatDate(period.start)} - ${formatDate(period.end)}`
}
