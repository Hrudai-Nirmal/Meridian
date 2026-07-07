import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildWorkflowRunPayload,
  formatSuccessMessage,
  main,
  normalizeDemoMode,
} from "../src/live-workflow.mjs"

test("normalizes supported demo modes and rejects unknown modes", () => {
  assert.equal(normalizeDemoMode(undefined), "success")
  assert.equal(normalizeDemoMode("success"), "success")
  assert.equal(normalizeDemoMode("degraded"), "degraded")
  assert.equal(normalizeDemoMode("failed"), "failed")
  assert.throws(() => normalizeDemoMode("slow"), /MERIDIAN_DEMO_MODE/)
})

test("success mode creates a successful support triage payload", () => {
  const payload = buildWorkflowRunPayload({
    nodeId: "node_123",
    mode: "success",
    now: new Date("2026-07-07T10:00:00.000Z"),
  })

  assert.equal(payload.nodeId, "node_123")
  assert.equal(payload.status, "success")
  assert.equal(payload.costUsd, 0.021)
  assert.equal(payload.tokens, 1480)
  assert.equal(payload.steps.length, 5)
  assert.equal(payload.steps.every((step) => step.status === "success"), true)
  assert.deepEqual(
    payload.steps.map((step) => step.name),
    ["Receive request", "Classify intent", "Retrieve account context", "Draft response", "Complete handoff"],
  )
})

test("degraded mode creates a degraded run and degraded context step", () => {
  const payload = buildWorkflowRunPayload({
    nodeId: "node_123",
    mode: "degraded",
    now: new Date("2026-07-07T10:00:00.000Z"),
  })

  assert.equal(payload.status, "degraded")
  assert.equal(payload.steps.find((step) => step.name === "Retrieve account context")?.status, "degraded")
  assert.equal(payload.steps.find((step) => step.status === "failed"), undefined)
})

test("failed mode creates a failed run and failed response step", () => {
  const payload = buildWorkflowRunPayload({
    nodeId: "node_123",
    mode: "failed",
    now: new Date("2026-07-07T10:00:00.000Z"),
  })

  assert.equal(payload.status, "failed")
  assert.equal(payload.steps.find((step) => step.name === "Draft response")?.status, "failed")
})

test("success output is secret-safe", () => {
  const payload = buildWorkflowRunPayload({
    nodeId: "node_123",
    mode: "success",
    now: new Date("2026-07-07T10:00:00.000Z"),
  })
  const message = formatSuccessMessage(payload, "secret_token_value")

  assert.match(message, /node_123/)
  assert.match(message, /success/)
  assert.equal(message.includes("secret_token_value"), false)
})

test("main validates required environment before creating the client", async () => {
  const writes = []
  const exitCode = await main({
    env: {},
    createClient() {
      throw new Error("client should not be created")
    },
    stdout: { write: (message) => writes.push(message) },
    stderr: { write: (message) => writes.push(message) },
  })

  assert.equal(exitCode, 1)
  assert.match(writes.join(""), /MERIDIAN_INGESTION_TOKEN/)
  assert.match(writes.join(""), /MERIDIAN_NODE_ID/)
})

test("main sends one payload and never prints the token", async () => {
  const calls = []
  const exitCode = await main({
    env: {
      MERIDIAN_INGESTION_TOKEN: "secret_token_value",
      MERIDIAN_NODE_ID: "node_123",
      MERIDIAN_DEMO_MODE: "degraded",
    },
    createClient(options) {
      calls.push({ options })
      return {
        async ingestRun(payload) {
          calls.push({ payload })
        },
        async flush() {
          calls.push({ flushed: true })
        },
      }
    },
    stdout: { write: (message) => calls.push({ stdout: message }) },
    stderr: { write: (message) => calls.push({ stderr: message }) },
  })

  assert.equal(exitCode, 0)
  assert.equal(calls[0].options.token, "secret_token_value")
  assert.equal(calls[1].payload.nodeId, "node_123")
  assert.equal(calls[1].payload.status, "degraded")
  assert.equal(calls[2].flushed, true)
  assert.equal(JSON.stringify(calls.filter((call) => call.stdout || call.stderr)).includes("secret_token_value"), false)
})
