import assert from "node:assert/strict"
import { test } from "node:test"

import { formatSafeMetadata } from "../src/lib/safe-metadata-format.mjs"

test("formatSafeMetadata renders nested actor objects as readable labels", () => {
  const formatted = formatSafeMetadata({
    actor: { name: "QA Operator", email: "qa@example.com" },
    title: "Report created",
    hasMapImage: true,
  })

  assert.equal(formatted, "actor: QA Operator <qa@example.com> | title: Report created | hasMapImage: true")
})

test("formatSafeMetadata skips complex objects that do not have a safe display value", () => {
  const formatted = formatSafeMetadata({
    actor: { id: "usr_123" },
    title: "Report revoked",
    nested: { raw: "hidden" },
  })

  assert.equal(formatted, "title: Report revoked")
})
