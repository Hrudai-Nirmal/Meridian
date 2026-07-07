import assert from "node:assert/strict"
import { test } from "node:test"

import { getApiSetupFieldHelp, getAuthHeaderPlaceholder } from "../src/lib/api-setup-help.mjs"

test("getAuthHeaderPlaceholder explains the selected auth header shape", () => {
  assert.equal(getAuthHeaderPlaceholder("BEARER_TOKEN"), "Authorization")
  assert.equal(getAuthHeaderPlaceholder("API_KEY_HEADER"), "x-api-key")
  assert.equal(getAuthHeaderPlaceholder("CUSTOM_HEADERS"), "x-tenant-token")
})

test("getApiSetupFieldHelp returns contextual examples for API mapping fields", () => {
  const jsonPathHelp = getApiSetupFieldHelp("jsonPath")
  assert.equal(jsonPathHelp.title, "JSONPath")
  assert.match(jsonPathHelp.description, /where Meridian should read/)
  assert.ok(jsonPathHelp.examples.includes("$.summary.success_rate"))

  const customHeaderHelp = getApiSetupFieldHelp("customHeaders")
  assert.match(customHeaderHelp.description, /vendor-specific/)
  assert.ok(customHeaderHelp.examples.includes("x-tenant-token: <secret value>"))
})
