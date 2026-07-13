export type ProviderOnboardingCopy = {
  providerName: string
  configureTitle: string
  runTitle: string
  signalReceivedLabel: string
  awaitingSignalLabel: string
  setupInstruction: string
}

export type ProviderFirstSignalStage = "select-node" | "create-token" | "send-first-run" | "run-received"

export type ProviderFirstSignalStatus = {
  stage: ProviderFirstSignalStage
  badge: string
  title: string
  detail: string
  primaryAction: string
}

export function getProviderOnboardingCopy(providerId: string): ProviderOnboardingCopy

export function buildProviderFirstSignalStatus(input: {
  providerId: string
  hasSelectedNode: boolean
  hasToken: boolean
  hasRun: boolean
  latestRun?: { externalId?: string | null; status?: string | null; startedAt?: string | null } | null
}): ProviderFirstSignalStatus
