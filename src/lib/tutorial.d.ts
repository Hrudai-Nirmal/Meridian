export const FIRST_WORKFLOW_TUTORIAL_STORAGE_KEY: "meridian-tutorial:first-workflow:v1"

export type TutorialStepId = "map-node" | "integration-template" | "telemetry-test" | "verify-runs" | "client-proof"

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
}

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
