export type LaunchpadStepStatus = "done" | "current" | "waiting"

export type LaunchpadStep = {
  id: "create-node" | "connect-workflow" | "verify-ops" | "share-proof"
  title: string
  body: string
  status: LaunchpadStepStatus
  section: string
  actionLabel: string
}

export function buildFirstWorkflowLaunchpad(input: {
  nodeCount: number
  runCount: number
  metricCount: number
  activeReportCount: number
  activeAlertCount: number
}): LaunchpadStep[]
