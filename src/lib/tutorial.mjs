/**
 * Secret-safe tutorial definitions and state helpers for Meridian's guided
 * onboarding. UI components own rendering; this module owns stable step order,
 * evidence-based start points, and local-dismissal semantics.
 */

export const FIRST_WORKFLOW_TUTORIAL_STORAGE_KEY = "meridian-tutorial:first-workflow:v1"

/**
 * @typedef {"map-node" | "integration-template" | "telemetry-test" | "verify-runs" | "client-proof"} TutorialStepId
 * @typedef {"control-room" | "projects" | "map" | "runs" | "alerts" | "reports" | "integrations" | "testing" | "logs" | "team" | "settings"} TutorialSection
 * @typedef {object} TutorialStep
 * @property {TutorialStepId} id
 * @property {TutorialSection} section
 * @property {string} targetId
 * @property {string} title
 * @property {string} body
 * @property {string} fallbackBody
 */

/** @type {TutorialStep[]} */
export const firstWorkflowTutorialSteps = [
  {
    id: "map-node",
    section: "map",
    targetId: "map-canvas",
    title: "Start with the workflow map",
    body: "Pick or create the node that represents the first bot, workflow, API, or automation you want Meridian to monitor.",
    fallbackBody: "Open Automation Map and select the workflow node you want to connect first.",
  },
  {
    id: "integration-template",
    section: "integrations",
    targetId: "integrations-templates",
    title: "Choose the setup path",
    body: "Select Dify, n8n, GitHub Actions, or REST metric setup so Meridian can show provider-specific instructions.",
    fallbackBody: "Open Integrations and choose the provider that matches your workflow.",
  },
  {
    id: "telemetry-test",
    section: "integrations",
    targetId: "integrations-telemetry-test",
    title: "Send the first safe signal",
    body: "Create a one-time telemetry token or configure metric polling, then send a harmless test run or sample.",
    fallbackBody: "Use Integrations to create a token, send a test run, or configure metric polling for the selected node.",
  },
  {
    id: "verify-runs",
    section: "runs",
    targetId: "runs-table",
    title: "Verify Meridian received data",
    body: "Check the Runs view for status, timestamps, latency, cost, tokens, and step details from the workflow.",
    fallbackBody: "Open Runs and verify the first workflow signal appears with safe operational metadata.",
  },
  {
    id: "client-proof",
    section: "reports",
    targetId: "reports-preview",
    title: "Turn evidence into client proof",
    body: "Create a branded report link once data is flowing so stakeholders can review reliability, cost, incidents, and the map.",
    fallbackBody: "Open Reports to preview and share read-only client proof after telemetry arrives.",
  },
]

/**
 * @param {unknown} value
 * @returns {number}
 */
function safeCount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

/**
 * Chooses the first useful tutorial step from project evidence.
 *
 * @param {{ nodeCount: number, runCount: number, metricCount: number, activeReportCount: number }} input
 * @returns {number}
 */
export function getFirstWorkflowTutorialStartIndex(input) {
  const nodeCount = safeCount(input?.nodeCount)
  const runCount = safeCount(input?.runCount)
  const metricCount = safeCount(input?.metricCount)
  const activeReportCount = safeCount(input?.activeReportCount)
  const hasTelemetry = runCount > 0 || metricCount > 0

  if (nodeCount === 0) return 0
  if (!hasTelemetry) return 1
  if (activeReportCount > 0) return 4
  return 3
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isTutorialDismissed(value) {
  return value === "completed" || value === "skipped"
}

/**
 * @param {{ storageValue: unknown, runCount: number, metricCount: number }} input
 * @returns {boolean}
 */
export function shouldAutoStartFirstWorkflowTutorial(input) {
  if (isTutorialDismissed(input?.storageValue)) return false
  return safeCount(input?.runCount) === 0 && safeCount(input?.metricCount) === 0
}
