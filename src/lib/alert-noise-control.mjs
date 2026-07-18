/**
 * Alert repeat suppression and grouped-incident presentation helpers.
 */

export const DEFAULT_ALERT_SUPPRESSION_MINUTES = 60
export const MAX_ALERT_SUPPRESSION_MINUTES = 1440

function numberOrDefault(value, fallback) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Normalizes a rule suppression window in minutes.
 */
export function getAlertSuppressionMinutes(metadata) {
  const value = metadata && typeof metadata === "object" ? metadata.suppressionMinutes : undefined
  const parsed = numberOrDefault(value, DEFAULT_ALERT_SUPPRESSION_MINUTES)
  return Math.min(MAX_ALERT_SUPPRESSION_MINUTES, Math.max(0, Math.round(parsed)))
}

/**
 * Decides whether a repeated alert occurrence is inside its suppression window.
 */
export function shouldSuppressAlertRepeat({ lastSeenAt, now, suppressionMinutes }) {
  if (!lastSeenAt || suppressionMinutes <= 0) return false
  const lastSeenTime = new Date(lastSeenAt).getTime()
  const nowTime = new Date(now).getTime()
  if (!Number.isFinite(lastSeenTime) || !Number.isFinite(nowTime)) return false
  return nowTime - lastSeenTime < suppressionMinutes * 60 * 1000
}

/**
 * Returns compact operator-facing suppression copy.
 */
export function buildAlertSuppressionSummary(suppressionMinutes) {
  if (suppressionMinutes <= 0) return "No suppression window"
  if (suppressionMinutes % 60 === 0) {
    const hours = suppressionMinutes / 60
    return `Suppress repeats for ${hours} ${hours === 1 ? "hour" : "hours"}`
  }
  return `Suppress repeats for ${suppressionMinutes} minutes`
}
