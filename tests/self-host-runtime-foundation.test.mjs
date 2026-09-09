import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

import { getMeridianRuntimeConfig } from "../src/lib/runtime-config.mjs"

test("runtime config defaults keep the hosted Meridian path intact", () => {
  const config = getMeridianRuntimeConfig({})

  assert.equal(config.deploymentMode, "cloud")
  assert.equal(config.edition, "cloud")
  assert.equal(config.billingMode, "paddle")
  assert.equal(config.jobBackend, "inngest")
  assert.equal(config.isSelfHosted, false)
  assert.equal(config.billingEnabled, true)
  assert.equal(config.label, "Meridian Cloud")
})

test("runtime config supports self-hosted community defaults without hosted billing", () => {
  const config = getMeridianRuntimeConfig({
    MERIDIAN_DEPLOYMENT_MODE: "self_hosted",
    MERIDIAN_EDITION: "community",
    MERIDIAN_BILLING_MODE: "",
    MERIDIAN_JOB_BACKEND: "",
  })

  assert.equal(config.deploymentMode, "self_hosted")
  assert.equal(config.edition, "community")
  assert.equal(config.billingMode, "disabled")
  assert.equal(config.jobBackend, "self_hosted")
  assert.equal(config.isSelfHosted, true)
  assert.equal(config.billingEnabled, false)
  assert.equal(config.label, "Self-hosted Community")
})

test("runtime config accepts the legacy default job backend fallback", () => {
  const config = getMeridianRuntimeConfig({
    MERIDIAN_DEPLOYMENT_MODE: "self_hosted",
    MERIDIAN_DEFAULT_JOB_BACKEND: "manual",
  })

  assert.equal(config.jobBackend, "manual")
})

test("runtime config clamps invalid env values to safe defaults", () => {
  const config = getMeridianRuntimeConfig({
    MERIDIAN_DEPLOYMENT_MODE: "laptop-party",
    MERIDIAN_EDITION: "pirate",
    MERIDIAN_BILLING_MODE: "cash",
    MERIDIAN_JOB_BACKEND: "spreadsheet",
  })

  assert.equal(config.deploymentMode, "cloud")
  assert.equal(config.edition, "cloud")
  assert.equal(config.billingMode, "paddle")
  assert.equal(config.jobBackend, "inngest")
})

test("health diagnostics expose self-host runtime posture without secrets", async () => {
  const runtimeConfig = await readFile("src/lib/runtime-config.mjs", "utf8")
  const runtimeEnvironment = await readFile("src/lib/runtime-environment.ts", "utf8")
  const health = await readFile("src/lib/health.ts", "utf8")

  assert.match(runtimeEnvironment, /getMeridianRuntimeConfig/)
  assert.match(runtimeEnvironment, /deploymentMode/)
  assert.match(runtimeEnvironment, /billingMode/)
  assert.match(runtimeEnvironment, /jobBackend/)
  assert.match(health, /runtime\.jobBackend/)
  assert.match(health, /SELF_HOSTED_WORKER_NOT_CONFIGURED/)
  assert.doesNotMatch(runtimeConfig + runtimeEnvironment + health, /pdl_(live|sdbx)_apikey|postgresql:\/\/|Bearer\s+[A-Za-z0-9._-]+|GOCSPX-/)
})

test("Billing and Testing surface runtime mode and disable checkout for self-hosted installs", async () => {
  const dashboard = await readFile("src/components/meridian/dashboard.tsx", "utf8")
  const readme = await readFile("README.md", "utf8")
  const context = await readFile("context.md", "utf8")
  const selfHostReadmeSection = readme.match(/### Self-Hosted Runtime Foundation[\s\S]*?Full Preview isolation/)?.[0] ?? ""

  assert.match(dashboard, /runtime\.deploymentMode/)
  assert.match(dashboard, /runtime\.billingMode/)
  assert.match(dashboard, /Community self-hosted/)
  assert.match(dashboard, /Hosted checkout is disabled in this runtime/)
  assert.match(dashboard, /Runtime mode/)
  assert.match(readme, /Self-Hosted Runtime Foundation/)
  assert.match(readme, /MERIDIAN_DEPLOYMENT_MODE=cloud \| self_hosted/)
  assert.match(context, /Self-Hosted Runtime Foundation v1/)
  assert.doesNotMatch(selfHostReadmeSection + context, /pdl_(live|sdbx)_apikey|postgresql:\/\/|Bearer\s+[A-Za-z0-9._-]+/)
})
