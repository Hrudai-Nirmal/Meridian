/*
 * Secret-safe Meridian deployment-mode configuration. This helper normalizes
 * edition, billing, and job-backend posture without exposing raw credentials.
 */

const DEPLOYMENT_MODES = new Set(["cloud", "self_hosted"])
const EDITIONS = new Set(["cloud", "community", "enterprise"])
const BILLING_MODES = new Set(["paddle", "disabled", "license"])
const JOB_BACKENDS = new Set(["inngest", "self_hosted", "manual"])

function normalizeEnum(value, allowed, fallback) {
  const normalized = String(value ?? "").trim().toLowerCase()
  return allowed.has(normalized) ? normalized : fallback
}

function getFirstConfiguredValue(...values) {
  return values.find((value) => String(value ?? "").trim().length > 0)
}

function getDefaultEdition(deploymentMode) {
  return deploymentMode === "self_hosted" ? "community" : "cloud"
}

function getDefaultBillingMode(deploymentMode) {
  return deploymentMode === "self_hosted" ? "disabled" : "paddle"
}

function getDefaultJobBackend(deploymentMode) {
  return deploymentMode === "self_hosted" ? "self_hosted" : "inngest"
}

function getRuntimeLabel(config) {
  if (config.deploymentMode === "self_hosted") {
    return config.edition === "enterprise" ? "Self-hosted Enterprise" : "Self-hosted Community"
  }

  return config.edition === "enterprise" ? "Meridian Enterprise Cloud" : "Meridian Cloud"
}

/**
 * Returns normalized Meridian runtime posture from env-like input.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function getMeridianRuntimeConfig(env = process.env) {
  const deploymentMode = normalizeEnum(env.MERIDIAN_DEPLOYMENT_MODE, DEPLOYMENT_MODES, "cloud")
  const edition = normalizeEnum(env.MERIDIAN_EDITION, EDITIONS, getDefaultEdition(deploymentMode))
  const billingMode = normalizeEnum(env.MERIDIAN_BILLING_MODE, BILLING_MODES, getDefaultBillingMode(deploymentMode))
  const jobBackendInput = getFirstConfiguredValue(env.MERIDIAN_JOB_BACKEND, env.MERIDIAN_DEFAULT_JOB_BACKEND)
  const jobBackend = normalizeEnum(jobBackendInput, JOB_BACKENDS, getDefaultJobBackend(deploymentMode))
  const config = {
    deploymentMode,
    edition,
    billingMode,
    jobBackend,
    isSelfHosted: deploymentMode === "self_hosted",
    billingEnabled: billingMode !== "disabled",
    label: "",
  }

  return {
    ...config,
    label: getRuntimeLabel(config),
  }
}
