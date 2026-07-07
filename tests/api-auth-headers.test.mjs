import assert from "node:assert/strict"
import { test } from "node:test"

import { buildApiAuthHeaderEntries, validateApiAuthConfig } from "../src/lib/api-auth-headers.mjs"

test("validateApiAuthConfig allows unauthenticated endpoints without secret fields", () => {
  assert.deepEqual(validateApiAuthConfig({ authType: "NONE", authHeaderName: "", secretValue: "" }), { ok: true })
})

test("validateApiAuthConfig requires a header and secret for authenticated endpoints", () => {
  assert.deepEqual(validateApiAuthConfig({ authType: "BEARER_TOKEN", authHeaderName: "", secretValue: "token" }), {
    ok: false,
    error: "Auth header is required when an auth type is selected.",
  })
  assert.deepEqual(validateApiAuthConfig({ authType: "API_KEY_HEADER", authHeaderName: "x-api-key", secretValue: "" }), {
    ok: false,
    error: "Secret value is required when an auth type is selected.",
  })
})

test("buildApiAuthHeaderEntries applies auth-specific header values", () => {
  assert.deepEqual(
    buildApiAuthHeaderEntries({
      authType: "BEARER_TOKEN",
      authHeaderName: "Authorization",
      secretValue: "mdn_token",
    }),
    { ok: true, headers: [["Authorization", "Bearer mdn_token"]] }
  )
  assert.deepEqual(
    buildApiAuthHeaderEntries({
      authType: "BASIC",
      authHeaderName: "Authorization",
      secretValue: "encoded-user-pass",
    }),
    { ok: true, headers: [["Authorization", "Basic encoded-user-pass"]] }
  )
  assert.deepEqual(
    buildApiAuthHeaderEntries({
      authType: "CUSTOM_HEADERS",
      authHeaderName: "x-tenant-token",
      secretValue: "tenant-secret",
    }),
    { ok: true, headers: [["x-tenant-token", "tenant-secret"]] }
  )
})

test("buildApiAuthHeaderEntries rejects unsafe header names", () => {
  assert.deepEqual(
    buildApiAuthHeaderEntries({
      authType: "API_KEY_HEADER",
      authHeaderName: "x-api-key\nx-leak",
      secretValue: "secret",
    }),
    { ok: false, error: "Auth header must be a valid HTTP header name, such as Authorization or x-api-key." }
  )
})
