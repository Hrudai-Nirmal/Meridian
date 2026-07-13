export type AlertRuleTemplateSource = "metric" | "run"
export type AlertRuleRunMetric = "status" | "durationMs" | "costUsd" | "tokens" | "failureRate" | "averageDurationMs"

export type AlertRuleTemplate = {
  id: string
  source: AlertRuleTemplateSource
  category: string
  title: string
  description: string
  mode?: "threshold" | "anomaly"
  expression?: string
  anomalyDirection?: "high" | "low" | "both"
  runMetric?: AlertRuleRunMetric
  windowRuns?: number
  severity: "INFO" | "WARNING" | "CRITICAL"
}

export const ALERT_RULE_TEMPLATES: AlertRuleTemplate[]

/**
 * Finds a rule template by its stable id.
 */
export function getAlertRuleTemplate(templateId: string): AlertRuleTemplate | null

/**
 * Builds a draft alert-rule payload that the UI can show and edit before save.
 */
export function buildAlertRulePayloadFromTemplate(
  templateId: string,
  context: {
    nodeId: string
    nodeLabel?: string
    mappingId?: string
    mappingLabel?: string
    unit?: string
  }
): Record<string, unknown>
