export const MERIDIAN_JAVASCRIPT_SDK_PACKAGE: "@meridian-workflows/sdk"
export const MERIDIAN_PRODUCTION_BASE_URL: "https://meridian.hrudainirmal.in"

export function buildSdkInstallCommand(): string
export function buildSdkEnvironmentBlock(nodeId: string): string
export function buildSdkTestRunCommand(): string
export function buildJavascriptSdkSnippet(options: { nodeId: string; operationName?: string }): string
