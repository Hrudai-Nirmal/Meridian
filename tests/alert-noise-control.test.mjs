import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

import {
  DEFAULT_ALERT_SUPPRESSION_MINUTES,
  buildAlertSuppressionSummary,
  getAlertSuppressionMinutes,
  shouldSuppressAlertRepeat,
} from "../src/lib/alert-noise-control.mjs"

test("alert suppression defaults to one hour and clamps unsafe input", () => {
  assert.equal(DEFAULT_ALERT_SUPPRESSION_MINUTES, 60)
  assert.equal(getAlertSuppressionMinutes({}), 60)
  assert.equal(getAlertSuppressionMinutes({ suppressionMinutes: 0 }), 0)
  assert.equal(getAlertSuppressionMinutes({ suppressionMinutes: -10 }), 0)
  assert.equal(getAlertSuppressionMinutes({ suppressionMinutes: 99999 }), 1440)
})

test("alert repeat suppression respects the last seen timestamp", () => {
  const lastSeenAt = new Date("2026-07-18T10:00:00.000Z")

  assert.equal(
    shouldSuppressAlertRepeat({
      lastSeenAt,
      now: new Date("2026-07-18T10:45:00.000Z"),
      suppressionMinutes: 60,
    }),
    true
  )
  assert.equal(
    shouldSuppressAlertRepeat({
      lastSeenAt,
      now: new Date("2026-07-18T11:01:00.000Z"),
      suppressionMinutes: 60,
    }),
    false
  )
})

test("suppression summary is operator readable", () => {
  assert.equal(buildAlertSuppressionSummary(0), "No suppression window")
  assert.equal(buildAlertSuppressionSummary(30), "Suppress repeats for 30 minutes")
  assert.equal(buildAlertSuppressionSummary(120), "Suppress repeats for 2 hours")
})

test("alert rule metadata preserves suppression minutes", async () => {
  const source = await readFile("src/lib/alert-rule-metadata.ts", "utf8")

  assert.match(source, /suppressionMinutes:\s*number/)
  assert.match(source, /getAlertSuppressionMinutes/)
  assert.match(source, /suppressionMinutes:\s*getAlertSuppressionMinutes/)
})

test("shared alert helper updates repeated incidents instead of ignoring them", async () => {
  const source = await readFile("src/lib/alert-events.ts", "utf8")

  assert.match(source, /occurrenceCount:\s*\{\s*increment:\s*1\s*\}/)
  assert.match(source, /lastSeenAt:\s*now/)
  assert.match(source, /suppressed/)
})

test("alert views expose grouped incident evidence", async () => {
  const workspace = await readFile("src/lib/workspace.ts", "utf8")
  const logs = await readFile("src/app/api/projects/[projectId]/logs/route.ts", "utf8")
  const report = await readFile("src/lib/reports.ts", "utf8")
  const dashboard = await readFile("src/components/meridian/dashboard.tsx", "utf8")

  assert.match(workspace, /occurrenceCount/)
  assert.match(workspace, /lastSeenAt/)
  assert.match(logs, /occurrenceCount/)
  assert.match(report, /occurrenceCount/)
  assert.match(dashboard, /Repeat suppression/)
  assert.match(dashboard, /occurrenceCount/)
})
