/**
 * Client-proof presentation helpers for public reports.
 */

const INCIDENT_FILTERS = new Set(["all", "active", "resolved"])

function formatNumber(value, options = {}) {
  return new Intl.NumberFormat("en-US", options).format(value)
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value)
}

/**
 * Formats previous-period deltas with a reader-facing tone.
 *
 * @param {{ current: number, previous: number, unit?: string, higherIsBetter?: boolean }} input
 * @returns {{ label: string, tone: "good" | "bad" | "neutral" }}
 */
export function formatReportComparisonBadge(input) {
  const delta = input.current - input.previous
  if (delta === 0) return { label: `No change vs previous period${input.unit ?? ""}`, tone: "neutral" }

  const sign = delta > 0 ? "+" : ""
  const label = `${sign}${formatNumber(delta)}${input.unit ?? ""} vs previous period`
  if (typeof input.higherIsBetter !== "boolean") return { label, tone: "neutral" }
  const isGood = input.higherIsBetter ? delta > 0 : delta < 0
  return { label, tone: isGood ? "good" : "bad" }
}

/**
 * Builds a copyable summary agencies can paste into client emails.
 *
 * @param {Record<string, any>} report
 * @returns {string}
 */
export function buildClientReportSummary(report) {
  const client = report.clientName ? `${report.clientName} ` : ""
  const comparison = report.comparison
    ? ` Compared with ${report.comparison.label}, runs changed from ${formatNumber(report.comparison.summary.totalRuns)} to ${formatNumber(report.summary.totalRuns)}, success rate changed from ${report.comparison.summary.successRate}% to ${report.summary.successRate}%, and active incidents changed from ${report.comparison.summary.activeAlerts} to ${report.summary.activeAlerts}.`
    : ""

  return `${report.title} for ${client}${report.projectName} covers ${report.period.label}. Meridian recorded ${formatNumber(report.summary.totalRuns)} workflow runs with ${report.summary.successRate}% success, ${report.summary.uptimePercent}% automation uptime, ${formatCurrency(report.summary.totalCostUsd)} tracked spend, and ${formatNumber(report.summary.totalTokens)} reported LLM tokens. There ${report.summary.activeAlerts === 1 ? "is" : "are"} ${formatNumber(report.summary.activeAlerts)} active ${report.summary.activeAlerts === 1 ? "incident" : "incidents"} at report generation.${comparison}`.trim()
}

/**
 * Filters public incident timeline rows by active/resolved state.
 *
 * @template T
 * @param {T[]} incidents
 * @param {string} filter
 * @returns {T[]}
 */
export function getFilteredIncidentTimeline(incidents, filter) {
  const normalizedFilter = INCIDENT_FILTERS.has(filter) ? filter : "all"
  if (normalizedFilter === "all") return incidents
  return incidents.filter((incident) => incident?.status === normalizedFilter)
}
