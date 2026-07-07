/*
 * Published SDK onboarding snippets for Meridian telemetry setup.
 *
 * These helpers intentionally emit placeholders for secrets so browser-visible
 * setup guidance can be node-specific without leaking ingestion tokens.
 */

export const MERIDIAN_JAVASCRIPT_SDK_PACKAGE = "@meridian-workflows/sdk"
export const MERIDIAN_PRODUCTION_BASE_URL = "https://meridian.hrudainirmal.in"

export function buildSdkInstallCommand() {
  return `npm install ${MERIDIAN_JAVASCRIPT_SDK_PACKAGE}`
}

export function buildSdkEnvironmentBlock(nodeId) {
  return [
    "MERIDIAN_INGESTION_TOKEN=<ingestion-token>",
    `MERIDIAN_NODE_ID=${nodeId || "<endpoint-node-id>"}`,
    `MERIDIAN_BASE_URL=${MERIDIAN_PRODUCTION_BASE_URL}`,
  ].join("\n")
}

export function buildSdkTestRunCommand() {
  return "node node_modules/@meridian-workflows/sdk/examples/send-test-run.mjs"
}

export function buildJavascriptSdkSnippet({ nodeId, operationName = "Meridian automation" }) {
  const safeNodeId = nodeId || "<endpoint-node-id>"
  const safeOperationName = operationName.replace(/\\/g, "\\\\").replace(/"/g, '\\"')

  return `import { createMeridian } from "${MERIDIAN_JAVASCRIPT_SDK_PACKAGE}"

const meridian = createMeridian({
  token: process.env.MERIDIAN_INGESTION_TOKEN,
  baseUrl: process.env.MERIDIAN_BASE_URL,
  onError(error) {
    console.warn("Meridian telemetry failed.", error)
  },
})

await meridian.trace(
  { nodeId: process.env.MERIDIAN_NODE_ID || "${safeNodeId}", name: "${safeOperationName}" },
  async () => {
    return await runAutomation()
  },
)

await meridian.flush()`
}
