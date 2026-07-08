export type IntegrationWizardStep = {
  id: string
  title: string
  body: string
  status: "done" | "current" | "waiting"
}

export function buildIntegrationWizardSteps(input: {
  setupKind: "metric" | "telemetry"
  providerId: string
  hasSelectedNode: boolean
  hasCreatedToken: boolean
  hasRecentRun: boolean
  hasMetricSetup: boolean
}): IntegrationWizardStep[]

export function buildProviderSetupCopy(input: {
  providerId: string
  nodeId: string
}): {
  codeNode: string
  httpRequest: string
}
