export type ReportComparisonTone = "good" | "bad" | "neutral"
export type IncidentTimelineFilter = "all" | "active" | "resolved"

/**
 * Formats previous-period deltas with a reader-facing tone.
 */
export function formatReportComparisonBadge(input: {
  current: number
  previous: number
  unit?: string
  higherIsBetter?: boolean
}): {
  label: string
  tone: ReportComparisonTone
}

/**
 * Builds a copyable summary agencies can paste into client emails.
 */
export function buildClientReportSummary(report: {
  title: string
  clientName: string | null
  projectName: string
  period: { label: string }
  summary: {
    uptimePercent: number
    totalRuns: number
    successRate: number
    totalCostUsd: number
    totalTokens: number
    activeAlerts: number
  }
  comparison: {
    label: string
    summary: {
      totalRuns: number
      successRate: number
      activeAlerts: number
    }
  } | null
}): string

/**
 * Filters public incident timeline rows by active/resolved state.
 */
export function getFilteredIncidentTimeline<T extends { status?: string }>(incidents: T[], filter: string): T[]
