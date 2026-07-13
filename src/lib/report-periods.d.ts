export type ReportPeriodMode = "window" | "custom" | "all"
export type ReportPeriodWindow = "7d" | "30d" | "90d"

export type ResolvedReportPeriod = {
  mode: ReportPeriodMode
  window: ReportPeriodWindow | null
  start: Date | null
  end: Date | null
  comparisonEnabled: boolean
  previous: {
    start: Date
    end: Date
  } | null
}

/**
 * Resolves user-facing period controls into current and previous query ranges.
 */
export function resolveReportPeriod(input?: {
  mode?: string
  window?: string | null
  start?: string | Date | null
  end?: string | Date | null
  comparisonEnabled?: boolean
  now?: Date
}): ResolvedReportPeriod

/**
 * Formats a resolved period for client-ready reports.
 */
export function formatReportPeriodLabel(period: ResolvedReportPeriod): string
