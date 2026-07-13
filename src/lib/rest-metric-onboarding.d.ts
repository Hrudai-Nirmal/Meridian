export type RestMetricEvidence = {
  label: string
  displayValue: string
  sampledAt: string
}

export type RestMetricOnboardingStage = "select-node" | "save-setup" | "run-first-poll" | "real-sample-received"

export type RestMetricOnboardingStatus = {
  stage: RestMetricOnboardingStage
  badge: string
  title: string
  detail: string
  primaryAction: string
  evidence: RestMetricEvidence | null
}

export function getLatestRealMetricEvidence(realMetrics: RestMetricEvidence[]): RestMetricEvidence | null

export function buildRestMetricOnboardingStatus(input: {
  hasSelectedNode: boolean
  hasSavedMapping: boolean
  realMetrics: RestMetricEvidence[]
  latestPollStatus?: string | null
  latestPollError?: string | null
}): RestMetricOnboardingStatus
