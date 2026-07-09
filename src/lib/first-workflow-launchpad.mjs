/**
 * Builds Meridian's first-workflow launch checklist from safe project evidence.
 * The launchpad avoids secrets and only describes what the current project has
 * already proven: graph nodes, received telemetry, operational visibility, and
 * client proof links.
 */

/**
 * @typedef {"done" | "current" | "waiting"} LaunchpadStepStatus
 * @typedef {object} LaunchpadStep
 * @property {"create-node" | "connect-workflow" | "verify-ops" | "share-proof"} id
 * @property {string} title
 * @property {string} body
 * @property {LaunchpadStepStatus} status
 * @property {string} section
 * @property {string} actionLabel
 */

/**
 * @param {unknown} value
 * @returns {number}
 */
function safeCount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

/**
 * Returns "1 thing" or "n things" for compact status copy.
 *
 * @param {number} count
 * @param {string} singular
 * @param {string=} plural
 * @returns {string}
 */
function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

/**
 * Builds a four-step first workflow launchpad.
 *
 * @param {{
 *   nodeCount: number,
 *   runCount: number,
 *   metricCount: number,
 *   activeReportCount: number,
 *   activeAlertCount: number,
 * }} input
 * @returns {LaunchpadStep[]}
 */
export function buildFirstWorkflowLaunchpad(input) {
  const nodeCount = safeCount(input?.nodeCount)
  const runCount = safeCount(input?.runCount)
  const metricCount = safeCount(input?.metricCount)
  const activeReportCount = safeCount(input?.activeReportCount)
  const activeAlertCount = safeCount(input?.activeAlertCount)
  const hasNode = nodeCount > 0
  const hasTelemetry = runCount > 0 || metricCount > 0
  const hasReport = activeReportCount > 0
  const hasOpsEvidence = hasTelemetry

  return [
    {
      id: "create-node",
      title: "Create or select a workflow node",
      body: hasNode
        ? `${pluralize(nodeCount, "node")} on the Automation Map. Pick the one that represents your first live workflow.`
        : "Start with one node that represents the workflow, bot, API, or automation you want Meridian to watch.",
      status: hasNode ? "done" : "current",
      section: "map",
      actionLabel: hasNode ? "Open map" : "Create node",
    },
    {
      id: "connect-workflow",
      title: "Connect telemetry or metric polling",
      body: hasTelemetry
        ? `${pluralize(runCount, "run")} and ${pluralize(metricCount, "metric stream")} are already feeding Meridian.`
        : "Create a telemetry token, use a provider setup guide, or configure API polling so Meridian receives its first signal.",
      status: hasTelemetry ? "done" : hasNode ? "current" : "waiting",
      section: "integrations",
      actionLabel: "Open integrations",
    },
    {
      id: "verify-ops",
      title: "Verify runs, health, and alerts",
      body: hasOpsEvidence
        ? `${pluralize(runCount, "run")} captured with ${pluralize(activeAlertCount, "active alert")} currently open. Review Runs, Logs, and the node summary cards.`
        : "After the first run or metric sample arrives, confirm Runs, Logs, live status, node cards, and alert behavior update correctly.",
      status: hasOpsEvidence ? "done" : hasNode ? "waiting" : "waiting",
      section: "runs",
      actionLabel: "Review runs",
    },
    {
      id: "share-proof",
      title: "Share client proof",
      body: hasReport
        ? `${pluralize(activeReportCount, "active report link")} ready for client review.`
        : "Create a branded report link once telemetry exists so stakeholders can see reliability, cost, tokens, incidents, and the automation map.",
      status: hasReport ? "done" : hasTelemetry ? "current" : "waiting",
      section: "reports",
      actionLabel: "Create report",
    },
  ]
}
