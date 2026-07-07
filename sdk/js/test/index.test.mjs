import assert from "node:assert/strict"
import { test } from "node:test"

import { createMeridian } from "../dist/index.js"

function createDeferredFetch(response = { ok: true, status: 202 }) {
  const requests = []
  let resolveFetch
  const completed = new Promise((resolve) => {
    resolveFetch = resolve
  })

  globalThis.fetch = async (url, options) => {
    requests.push({ url, options })
    await completed
    return response
  }

  return {
    requests,
    complete: () => resolveFetch(),
  }
}

test("validates required client and run fields before network delivery", async () => {
  assert.throws(() => createMeridian({ token: "" }), /token/i)

  const meridian = createMeridian({ token: "token_test", baseUrl: "https://example.test" })
  await assert.rejects(
    () =>
      meridian.ingestRun({
        nodeId: "",
        status: "success",
        startedAt: new Date().toISOString(),
      }),
    /nodeId/i,
  )
})

test("flush waits for fire-and-forget trace delivery to settle", async () => {
  const deferredFetch = createDeferredFetch()
  const meridian = createMeridian({ token: "token_test", baseUrl: "https://example.test" })

  const result = await meridian.trace({ nodeId: "node_123", name: "Demo trace" }, async () => "handled")

  assert.equal(result, "handled")
  assert.equal(deferredFetch.requests.length, 1)
  assert.equal(typeof meridian.flush, "function")

  const flushed = meridian.flush()
  deferredFetch.complete()
  await flushed

  assert.equal(deferredFetch.requests[0].url, "https://example.test/api/ingest/runs")
  assert.equal(deferredFetch.requests[0].options.headers.Authorization, "Bearer token_test")
})

test("reports delivery failures through onError without breaking trace results", async () => {
  const errors = []
  globalThis.fetch = async () => ({ ok: false, status: 503 })
  const meridian = createMeridian({
    token: "token_test",
    baseUrl: "https://example.test",
    onError: (error) => errors.push(error),
  })

  const result = await meridian.trace({ nodeId: "node_123" }, () => "kept")
  await meridian.flush()

  assert.equal(result, "kept")
  assert.equal(errors.length, 1)
  assert.match(String(errors[0]), /503/)
})

test("keeps trace results stable when the onError hook throws", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 503 })
  const meridian = createMeridian({
    token: "token_test",
    baseUrl: "https://example.test",
    onError() {
      throw new Error("observer failed")
    },
  })

  const result = await meridian.trace({ nodeId: "node_123" }, () => "kept")

  await assert.doesNotReject(() => meridian.flush())
  assert.equal(result, "kept")
})
