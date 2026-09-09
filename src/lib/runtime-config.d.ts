export type MeridianDeploymentMode = "cloud" | "self_hosted"
export type MeridianEdition = "cloud" | "community" | "enterprise"
export type MeridianBillingMode = "paddle" | "disabled" | "license"
export type MeridianJobBackend = "inngest" | "self_hosted" | "manual"

export type MeridianRuntimeConfig = {
  deploymentMode: MeridianDeploymentMode
  edition: MeridianEdition
  billingMode: MeridianBillingMode
  jobBackend: MeridianJobBackend
  isSelfHosted: boolean
  billingEnabled: boolean
  label: string
}

export function getMeridianRuntimeConfig(env?: Record<string, string | undefined>): MeridianRuntimeConfig
