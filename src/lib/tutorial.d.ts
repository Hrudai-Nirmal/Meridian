export const FIRST_WORKFLOW_TUTORIAL_STORAGE_KEY: "meridian-tutorial:first-workflow:v1"
export const TUTORIAL_WIDGET_PLACEMENT_STORAGE_KEY: "meridian-tutorial:first-workflow:widget-placement:v1"
export const TUTORIAL_WIDGET_COLLAPSED_STORAGE_KEY: "meridian-tutorial:first-workflow:widget-collapsed:v1"

export type TutorialStepId =
  | "open-map"
  | "add-node"
  | "select-node"
  | "open-integrations"
  | "choose-rest-template"
  | "open-api-setup"
  | "configure-endpoint"
  | "configure-jsonpath"
  | "test-endpoint"
  | "save-api-setup"
  | "run-poll"
  | "verify-metric"
  | "create-report"

export type TutorialSection =
  | "control-room"
  | "projects"
  | "map"
  | "runs"
  | "alerts"
  | "reports"
  | "integrations"
  | "testing"
  | "logs"
  | "team"
  | "settings"

export type TutorialStep = {
  id: TutorialStepId
  section: TutorialSection
  targetId: string
  title: string
  body: string
  fallbackBody: string
  completionKind?: "visited-step" | "node-exists" | "selected-node" | "rest-setup-saved" | "real-metric-sample" | "report-link"
}

export type TutorialEvidence = {
  nodeCount: number
  runCount: number
  metricCount: number
  activeReportCount: number
  selectedNodeId?: string | null
  restSetupCount?: number
  visitedStepIds?: TutorialStepId[]
}

export type TutorialWidgetPlacement = "bottom-center" | "bottom-left" | "bottom-right" | "top-left" | "top-right" | "left-center" | "right-center"

export const firstWorkflowTutorialSteps: TutorialStep[]

export function getFirstWorkflowTutorialStartIndex(input: {
  nodeCount: number
  runCount: number
  metricCount: number
  activeReportCount: number
}): number

export function isTutorialDismissed(value: unknown): boolean

export function shouldAutoStartFirstWorkflowTutorial(input: {
  storageValue: unknown
  runCount: number
  metricCount: number
}): boolean

export function buildFirstWorkflowTutorialProgress(input: {
  startEvidence: TutorialEvidence
  currentEvidence: TutorialEvidence
}): {
  completedStepIds: TutorialStepId[]
  completedCount: number
  totalCount: number
  percent: number
}

export function normalizeTutorialWidgetPlacement(value: unknown): TutorialWidgetPlacement

export function snapTutorialWidgetPlacement(
  point: { x: number; y: number },
  viewport: { width: number; height: number },
  widget: { width: number; height: number }
): TutorialWidgetPlacement
