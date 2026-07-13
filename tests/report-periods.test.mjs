import assert from "node:assert/strict"
import test from "node:test"

import {
  formatReportPeriodLabel,
  resolveReportPeriod,
} from "../src/lib/report-periods.mjs"

const now = new Date("2026-07-14T12:00:00.000Z")

test("window report periods compute current and previous ranges", () => {
  const period = resolveReportPeriod({
    mode: "window",
    window: "7d",
    comparisonEnabled: true,
    now,
  })

  assert.equal(period.mode, "window")
  assert.equal(period.window, "7d")
  assert.equal(period.start.toISOString(), "2026-07-07T12:00:00.000Z")
  assert.equal(period.end.toISOString(), "2026-07-14T12:00:00.000Z")
  assert.equal(period.previous.start.toISOString(), "2026-06-30T12:00:00.000Z")
  assert.equal(period.previous.end.toISOString(), "2026-07-07T12:00:00.000Z")
})

test("all report periods disable comparison", () => {
  const period = resolveReportPeriod({
    mode: "all",
    comparisonEnabled: true,
    now,
  })

  assert.equal(period.mode, "all")
  assert.equal(period.start, null)
  assert.equal(period.end, null)
  assert.equal(period.previous, null)
  assert.equal(period.comparisonEnabled, false)
})

test("custom report periods reject reversed ranges", () => {
  assert.throws(
    () =>
      resolveReportPeriod({
        mode: "custom",
        start: "2026-07-14",
        end: "2026-07-01",
        now,
      }),
    /end must be after start/i
  )
})

test("report period labels are client readable", () => {
  const period = resolveReportPeriod({
    mode: "custom",
    start: "2026-07-01",
    end: "2026-07-14",
    comparisonEnabled: false,
    now,
  })

  assert.equal(formatReportPeriodLabel(period), "Jul 1, 2026 - Jul 14, 2026")
})
