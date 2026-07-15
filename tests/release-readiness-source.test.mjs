import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

test("health readiness includes an explicit schema compatibility check", async () => {
  const source = await readFile("src/lib/health.ts", "utf8")

  assert.match(source, /schema:\s*false/)
  assert.match(source, /checks\.schema\s*=\s*true/)
  assert.match(source, /reportPreset\.findFirst/)
})

test("production smoke requires schema readiness when readiness is mandatory", async () => {
  const source = await readFile("scripts/smoke.mjs", "utf8")

  assert.match(source, /health\?\.checks\?\.schema\s*===\s*true/)
  assert.match(source, /Production database schema is not compatible/)
})
