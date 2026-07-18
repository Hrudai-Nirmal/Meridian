export const DEFAULT_ALERT_SUPPRESSION_MINUTES: number
export const MAX_ALERT_SUPPRESSION_MINUTES: number
export function getAlertSuppressionMinutes(metadata: unknown): number
export function shouldSuppressAlertRepeat(input: {
  lastSeenAt: Date | string | null | undefined
  now: Date | string
  suppressionMinutes: number
}): boolean
export function buildAlertSuppressionSummary(suppressionMinutes: number): string
