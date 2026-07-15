import assert from "node:assert/strict"
import { test } from "node:test"

import {
  parsePrismaMigrateStatus,
  redactReleaseOutput,
} from "../scripts/release-safety.mjs"

test("parsePrismaMigrateStatus detects an up-to-date production database", () => {
  const result = parsePrismaMigrateStatus(`
14 migrations found in prisma/migrations

Database schema is up to date!
`)

  assert.deepEqual(result, { ok: true, pendingMigrations: [] })
})

test("parsePrismaMigrateStatus extracts pending migration names", () => {
  const result = parsePrismaMigrateStatus(`
Following migration have not yet been applied:
20260714103000_alert_rules_client_proof_v3
20260715120000_release_safety_v1

To apply migrations in production run prisma migrate deploy.
`)

  assert.equal(result.ok, false)
  assert.deepEqual(result.pendingMigrations, [
    "20260714103000_alert_rules_client_proof_v3",
    "20260715120000_release_safety_v1",
  ])
})

test("release output redaction removes connection strings and known secret shapes", () => {
  const redacted = redactReleaseOutput(
    "postgresql://user:pass@example.neon.tech/neondb?sslmode=require npg_abc123 hooks.slack.com/services/T/B/C"
  )

  assert.equal(redacted.includes("postgresql://"), false)
  assert.equal(redacted.includes("npg_abc123"), false)
  assert.equal(redacted.includes("hooks.slack.com/services/"), false)
  assert.match(redacted, /\[redacted-database-url\]/)
})
