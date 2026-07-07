export type ApiSetupHelpField =
  | "overview"
  | "endpointUrl"
  | "authType"
  | "authHeaderName"
  | "secretValue"
  | "customHeaders"
  | "cadenceMin"
  | "mappingLabel"
  | "unit"
  | "jsonPath"
  | "transform"
  | "threshold"
  | "visualization"
  | "testEndpoint"
  | "saveSetup"

export type ApiSetupFieldHelp = {
  title: string
  description: string
  examples: string[]
}

export function getApiSetupFieldHelp(field: ApiSetupHelpField | string): ApiSetupFieldHelp

export function getAuthHeaderPlaceholder(authType: string): string
