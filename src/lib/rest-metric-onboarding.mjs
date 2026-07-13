/**
 * Secret-safe status helpers for Meridian's REST metric setup flow. The UI uses
 * these messages to keep first-signal onboarding consistent across Integrations,
 * Testing, and the selected node inspector.
 */

/**
 * @typedef {object} RestMetricEvidence
 * @property {string} label
 * @property {string} displayValue
 * @property {string} sampledAt
 */

/**
 * @typedef {"select-node" | "save-setup" | "run-first-poll" | "real-sample-received"} RestMetricOnboardingStage
 * @typedef {object} RestMetricOnboardingStatus
 * @property {RestMetricOnboardingStage} stage
 * @property {string} badge
 * @property {string} title
 * @property {string} detail
 * @property {string} primaryAction
 * @property {RestMetricEvidence | null} evidence
 */

/**
 * Returns the most recent persisted metric sample summary.
 *
 * @param {RestMetricEvidence[]} realMetrics
 * @returns {RestMetricEvidence | null}
 */
export function getLatestRealMetricEvidence(realMetrics) {
  if (!Array.isArray(realMetrics) || realMetrics.length === 0) return null

  return realMetrics.reduce((latestMetric, candidate) => {
    if (!candidate?.sampledAt) return latestMetric
    const candidateTime = new Date(candidate.sampledAt).getTime()
    if (!Number.isFinite(candidateTime)) return latestMetric
    if (!latestMetric) return candidate

    const latestTime = new Date(latestMetric.sampledAt).getTime()
    return candidateTime > latestTime ? candidate : latestMetric
  }, null)
}

/**
 * Builds the next user-facing step for a REST metric first-signal flow.
 *
 * @param {{
 *   hasSelectedNode: boolean,
 *   hasSavedMapping: boolean,
 *   realMetrics: RestMetricEvidence[],
 *   latestPollStatus?: string | null,
 *   latestPollError?: string | null,
 * }} input
 * @returns {RestMetricOnboardingStatus}
 */
export function buildRestMetricOnboardingStatus(input) {
  if (!input?.hasSelectedNode) {
    return {
      stage: "select-node",
      badge: "Select a node",
      title: "Pick where this metric belongs",
      detail: "Choose or create the Automation Map node that represents the endpoint Meridian should monitor.",
      primaryAction: "Open automation map",
      evidence: null,
    }
  }

  if (!input.hasSavedMapping) {
    return {
      stage: "save-setup",
      badge: "API setup needed",
      title: "Save the endpoint mapping",
      detail: "Use the demo endpoint or your own JSON endpoint, test the JSONPath mapping, then save API setup so polling has durable configuration.",
      primaryAction: "Save API setup",
      evidence: null,
    }
  }

  const evidence = getLatestRealMetricEvidence(input.realMetrics)
  if (evidence) {
    return {
      stage: "real-sample-received",
      badge: "Real sample received",
      title: "First metric signal is live",
      detail: `${evidence.label} reported ${evidence.displayValue} at ${evidence.sampledAt}.`,
      primaryAction: "Create report",
      evidence,
    }
  }

  const latestPollFailed = input.latestPollStatus === "FAILED" && input.latestPollError
  return {
    stage: "run-first-poll",
    badge: "Awaiting first real sample",
    title: "Run the first poll",
    detail: latestPollFailed
      ? `The latest poll failed: ${input.latestPollError}`
      : "API setup is saved. Run a manual poll now to fetch the endpoint and create the first persisted metric sample.",
    primaryAction: "Run first poll",
    evidence: null,
  }
}
