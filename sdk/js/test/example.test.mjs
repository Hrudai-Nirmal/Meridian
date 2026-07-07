import assert from "node:assert/strict"
import { test } from "node:test"

import { buildSyntheticRun, main } from "../examples/send-test-run.mjs"

test("JavaScript telemetry example validates required environment", async () => {
  const writes = []

  const exitCode = await main({
    env: {},
    createClient() {
      throw new Error("client should not be created")
    },
    stderr: { write: (message) => writes.push(message) },
    stdout: { write: () => undefined },
  })

  assert.equal(exitCode, 1)
  assert.match(writes.join(""), /MERIDIAN_INGESTION_TOKEN/)
  assert.match(writes.join(""), /MERIDIAN_NODE_ID/)
})

test("JavaScript telemetry example sends a safe synthetic run and flushes", async () => {
  const calls = []
  let flushed = false

  const exitCode = await main({
    env: {
      MERIDIAN_INGESTION_TOKEN: "secret_token_value",
      MERIDIAN_NODE_ID: "node_123",
      MERIDIAN_BASE_URL: "https://example.test",
    },
    createClient(options) {
      calls.push({ options })
      return {
        async ingestRun(payload) {
          calls.push({ payload })
        },
        async flush() {
          flushed = true
        },
      }
    },
    stderr: { write: () => undefined },
    stdout: { write: (message) => calls.push({ message }) },
  })

  assert.equal(exitCode, 0)
  assert.equal(flushed, true)
  assert.equal(calls[0].options.token, "secret_token_value")
  assert.equal(calls[0].options.baseUrl, "https://example.test")
  assert.equal(calls[1].payload.nodeId, "node_123")
  assert.equal(calls[1].payload.status, "success")
  assert.equal(calls[1].payload.steps[0].toolName, "meridian-js-example")
  assert.equal(calls.at(-1).message.includes("secret_token_value"), false)
})

test("JavaScript telemetry example builds bounded demo payloads", () => {
  const run = buildSyntheticRun({
    MERIDIAN_NODE_ID: "node_123",
    MERIDIAN_EXTERNAL_ID: "example_001",
  })

  assert.equal(run.nodeId, "node_123")
  assert.equal(run.externalId, "example_001")
  assert.equal(run.costUsd, 0.001)
  assert.equal(run.tokens, 128)
  assert.equal(run.steps.length, 2)
})
