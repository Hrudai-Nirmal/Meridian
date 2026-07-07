import assert from "node:assert/strict"
import { test } from "node:test"

import {
  MERIDIAN_JAVASCRIPT_SDK_PACKAGE,
  buildJavascriptSdkSnippet,
  buildSdkEnvironmentBlock,
  buildSdkInstallCommand,
  buildSdkTestRunCommand,
} from "../src/lib/sdk-onboarding.mjs"

test("builds published JavaScript SDK onboarding commands", () => {
  assert.equal(MERIDIAN_JAVASCRIPT_SDK_PACKAGE, "@meridian-workflows/sdk")
  assert.equal(buildSdkInstallCommand(), "npm install @meridian-workflows/sdk")
  assert.match(buildSdkTestRunCommand(), /node node_modules\/@meridian-workflows\/sdk\/examples\/send-test-run\.mjs/)
})

test("builds node-specific environment block without real tokens", () => {
  const envBlock = buildSdkEnvironmentBlock("node_123")

  assert.match(envBlock, /MERIDIAN_NODE_ID=node_123/)
  assert.match(envBlock, /MERIDIAN_INGESTION_TOKEN=<ingestion-token>/)
  assert.equal(envBlock.includes("secret_"), false)
})

test("builds copyable JavaScript trace snippet for the selected node", () => {
  const snippet = buildJavascriptSdkSnippet({ nodeId: "node_123", operationName: "Support triage agent" })

  assert.match(snippet, /import \{ createMeridian \} from "@meridian-workflows\/sdk"/)
  assert.match(snippet, /node_123/)
  assert.match(snippet, /MERIDIAN_INGESTION_TOKEN/)
  assert.match(snippet, /await meridian\.flush\(\)/)
  assert.equal(snippet.includes("<ingestion-token>"), false)
})
