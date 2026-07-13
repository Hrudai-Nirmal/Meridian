/**
 * Secret-safe tutorial definitions and state helpers for Meridian's guided
 * onboarding. UI components own rendering; this module owns stable step order,
 * evidence-based start points, and local-dismissal semantics.
 */

export const FIRST_WORKFLOW_TUTORIAL_STORAGE_KEY = "meridian-tutorial:first-workflow:v1"
export const TUTORIAL_WIDGET_PLACEMENT_STORAGE_KEY = "meridian-tutorial:first-workflow:widget-placement:v1"
export const TUTORIAL_WIDGET_COLLAPSED_STORAGE_KEY = "meridian-tutorial:first-workflow:widget-collapsed:v1"

export const tutorialWidgetPlacements = ["bottom-center", "bottom-left", "bottom-right", "top-left", "top-right", "left-center", "right-center"]

/**
 * @typedef {"open-map" | "add-node" | "select-node" | "open-integrations" | "choose-rest-template" | "open-api-setup" | "configure-endpoint" | "configure-jsonpath" | "test-endpoint" | "save-api-setup" | "run-poll" | "verify-metric" | "create-report"} TutorialStepId
 * @typedef {"control-room" | "projects" | "map" | "runs" | "alerts" | "reports" | "integrations" | "testing" | "logs" | "team" | "settings"} TutorialSection
 * @typedef {"visited-step" | "node-exists" | "selected-node" | "rest-setup-saved" | "real-metric-sample" | "report-link"} TutorialCompletionKind
 * @typedef {"bottom-center" | "bottom-left" | "bottom-right" | "top-left" | "top-right" | "left-center" | "right-center"} TutorialWidgetPlacement
 * @typedef {{ nodeCount: number, runCount: number, metricCount: number, activeReportCount: number, selectedNodeId?: string | null, restSetupCount?: number, visitedStepIds?: TutorialStepId[] }} TutorialEvidence
 * @typedef {object} TutorialStep
 * @property {TutorialStepId} id
 * @property {TutorialSection} section
 * @property {string} targetId
 * @property {string} title
 * @property {string} body
 * @property {string} fallbackBody
 * @property {TutorialCompletionKind=} completionKind
 */

/** @type {TutorialStep[]} */
export const firstWorkflowTutorialSteps = [
  {
    id: "open-map",
    section: "map",
    targetId: "map-canvas",
    title: "Open the automation map",
    body: "This is where Meridian keeps the monitored workflow nodes. Start here so the REST metric has a node to attach to.",
    fallbackBody: "Open Automation Map so Meridian can guide the REST metric setup on the workflow canvas.",
    completionKind: "visited-step",
  },
  {
    id: "add-node",
    section: "map",
    targetId: "map-add-node",
    title: "Create a node",
    body: "Add a node for the API, workflow, or automation health endpoint you want Meridian to poll.",
    fallbackBody: "Use Automation Map to add the node that will receive this REST metric.",
    completionKind: "node-exists",
  },
  {
    id: "select-node",
    section: "map",
    targetId: "map-inspector",
    title: "Select the node",
    body: "With a node selected, the inspector shows setup actions, metrics, runs, and API configuration for that exact workflow.",
    fallbackBody: "Select the node you just created so Meridian can show its setup controls.",
    completionKind: "selected-node",
  },
  {
    id: "open-integrations",
    section: "integrations",
    targetId: "integrations-templates",
    title: "Open integration templates",
    body: "Templates explain the setup path before you copy or apply anything. For this tutorial, use REST metric polling.",
    fallbackBody: "Open Integrations and find the REST metric template.",
    completionKind: "visited-step",
  },
  {
    id: "choose-rest-template",
    section: "integrations",
    targetId: "integrations-template-custom-rest-metric",
    title: "Choose REST metric setup",
    body: "The REST metric template is for endpoints Meridian polls on a schedule, such as health, latency, queue depth, or success score.",
    fallbackBody: "Choose the Custom REST metric template in Integrations.",
    completionKind: "selected-node",
  },
  {
    id: "open-api-setup",
    section: "map",
    targetId: "node-api-setup-action",
    title: "Open API setup",
    body: "API setup stores the endpoint URL, auth shape, JSONPath mapping, and threshold Meridian should use while polling.",
    fallbackBody: "Open the selected node's API setup controls from Automation Map.",
    completionKind: "selected-node",
  },
  {
    id: "configure-endpoint",
    section: "map",
    targetId: "api-setup-endpoint-url",
    title: "Enter the endpoint URL",
    body: "Use a safe endpoint that returns JSON. For testing, the demo metric endpoint can populate a known JSON shape.",
    fallbackBody: "Open API setup and fill in the endpoint URL.",
    completionKind: "rest-setup-saved",
  },
  {
    id: "configure-jsonpath",
    section: "map",
    targetId: "api-setup-jsonpath",
    title: "Map the JSON value",
    body: "The JSONPath tells Meridian which response value becomes the metric, for example a score, latency, or count.",
    fallbackBody: "Add the JSONPath mapping in API setup.",
    completionKind: "rest-setup-saved",
  },
  {
    id: "test-endpoint",
    section: "map",
    targetId: "api-setup-test-endpoint",
    title: "Test the endpoint",
    body: "Testing previews the JSON response and confirms whether the mapped value can be read before saving.",
    fallbackBody: "Run Test endpoint from API setup.",
    completionKind: "rest-setup-saved",
  },
  {
    id: "save-api-setup",
    section: "map",
    targetId: "api-setup-save",
    title: "Save API setup",
    body: "Saving turns the tested mapping into real project configuration that polling can use.",
    fallbackBody: "Save the API setup after the endpoint test looks correct.",
    completionKind: "rest-setup-saved",
  },
  {
    id: "run-poll",
    section: "testing",
    targetId: "testing-manual-poll",
    title: "Run a manual poll",
    body: "Manual poll asks Meridian to fetch configured endpoint metrics now, instead of waiting for scheduled polling.",
    fallbackBody: "Open Testing and run a manual poll for this project.",
    completionKind: "real-metric-sample",
  },
  {
    id: "verify-metric",
    section: "map",
    targetId: "node-metric-evidence",
    title: "Verify real metric evidence",
    body: "A real sample proves Meridian can read the endpoint. Sample fallback rows do not count as proof.",
    fallbackBody: "Return to the node and confirm a real metric sample is visible.",
    completionKind: "real-metric-sample",
  },
  {
    id: "create-report",
    section: "reports",
    targetId: "reports-create-link",
    title: "Create client proof",
    body: "Once a real signal exists, create a report link so a client can review uptime, evidence, costs, incidents, and the map.",
    fallbackBody: "Open Reports and create a read-only report link after real metric evidence exists.",
    completionKind: "report-link",
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
  if (!hasTelemetry) return 3
  if (activeReportCount > 0) return firstWorkflowTutorialSteps.findIndex((step) => step.id === "create-report")
  return firstWorkflowTutorialSteps.findIndex((step) => step.id === "verify-metric")
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

/**
 * Builds evidence-backed progress for the first-workflow tutorial.
 *
 * Meridian can prove durable milestones such as nodes, run/sample telemetry, and
 * report links. Provider selection is treated as ready once a target node exists
 * because that UI-only choice is not stored as durable project evidence.
 *
 * @param {{ startEvidence: TutorialEvidence, currentEvidence: TutorialEvidence }} input
 * @returns {{ completedStepIds: TutorialStepId[], completedCount: number, totalCount: number, percent: number }}
 */
export function buildFirstWorkflowTutorialProgress(input) {
  const startEvidence = input?.startEvidence ?? {}
  const currentEvidence = input?.currentEvidence ?? {}
  const currentNodeCount = safeCount(currentEvidence.nodeCount)
  const currentRunCount = safeCount(currentEvidence.runCount)
  const currentMetricCount = safeCount(currentEvidence.metricCount)
  const currentReportCount = safeCount(currentEvidence.activeReportCount)
  const visitedStepIds = Array.isArray(currentEvidence.visitedStepIds) ? currentEvidence.visitedStepIds : []
  const hasNode = currentNodeCount > 0
  const hasSelectedNode = Boolean(currentEvidence.selectedNodeId) || hasNode
  const hasRestSetup = safeCount(currentEvidence.restSetupCount) > 0
  const hasTelemetry = currentRunCount > safeCount(startEvidence.runCount) || currentMetricCount > safeCount(startEvidence.metricCount)
  const hasReport = currentReportCount > safeCount(startEvidence.activeReportCount)
  const completedStepIds = []

  for (const step of firstWorkflowTutorialSteps) {
    if (step.completionKind === "visited-step" && visitedStepIds.includes(step.id)) {
      completedStepIds.push(step.id)
    }
  }

  if (hasNode) {
    completedStepIds.push("add-node")
  }
  if (hasSelectedNode) {
    completedStepIds.push("select-node", "choose-rest-template", "open-api-setup")
  }
  if (hasRestSetup) {
    completedStepIds.push("configure-endpoint", "configure-jsonpath", "test-endpoint", "save-api-setup")
  }
  if (hasTelemetry) {
    completedStepIds.push("run-poll", "verify-metric")
  }
  if (hasReport) {
    completedStepIds.push("create-report")
  }

  const totalCount = firstWorkflowTutorialSteps.length

  return {
    completedStepIds,
    completedCount: completedStepIds.length,
    totalCount,
    percent: Math.round((completedStepIds.length / totalCount) * 100),
  }
}

/**
 * @param {unknown} value
 * @returns {TutorialWidgetPlacement}
 */
export function normalizeTutorialWidgetPlacement(value) {
  return tutorialWidgetPlacements.includes(value) ? /** @type {TutorialWidgetPlacement} */ (value) : "bottom-center"
}

/**
 * Chooses a stable edge/corner placement from a drag release point.
 *
 * @param {{ x: number, y: number }} point
 * @param {{ width: number, height: number }} viewport
 * @param {{ width: number, height: number }} widget
 * @returns {TutorialWidgetPlacement}
 */
export function snapTutorialWidgetPlacement(point, viewport, widget) {
  const safeViewport = {
    width: Math.max(1, Number(viewport?.width) || 1),
    height: Math.max(1, Number(viewport?.height) || 1),
  }
  const safeWidget = {
    width: Math.max(1, Number(widget?.width) || 1),
    height: Math.max(1, Number(widget?.height) || 1),
  }
  const margin = 20
  const candidates = [
    { placement: "bottom-center", x: safeViewport.width / 2, y: safeViewport.height - margin },
    { placement: "bottom-left", x: margin + safeWidget.width / 2, y: safeViewport.height - margin },
    { placement: "bottom-right", x: safeViewport.width - margin - safeWidget.width / 2, y: safeViewport.height - margin },
    { placement: "top-left", x: margin + safeWidget.width / 2, y: margin + safeWidget.height / 2 },
    { placement: "top-right", x: safeViewport.width - margin - safeWidget.width / 2, y: margin + safeWidget.height / 2 },
    { placement: "left-center", x: margin + safeWidget.width / 2, y: safeViewport.height / 2 },
    { placement: "right-center", x: safeViewport.width - margin - safeWidget.width / 2, y: safeViewport.height / 2 },
  ]
  const release = {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
  }
  const nearest = candidates.reduce((best, candidate) => {
    const distance = Math.hypot(release.x - candidate.x, release.y - candidate.y)
    return distance < best.distance ? { placement: candidate.placement, distance } : best
  }, { placement: "bottom-center", distance: Number.POSITIVE_INFINITY })

  return /** @type {TutorialWidgetPlacement} */ (nearest.placement)
}
