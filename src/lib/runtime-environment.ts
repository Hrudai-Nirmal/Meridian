/**
 * Secret-safe runtime environment detection and side-effect policy.
 */
import "server-only"

export type RuntimeEnvironmentName = "production" | "preview" | "development"

export type RuntimeEnvironment = {
  environment: RuntimeEnvironmentName
  label: string
  deploymentUrl: string
  isProduction: boolean
  isPreview: boolean
  isLocal: boolean
  externalSideEffectsEnabled: boolean
  backgroundJobsEnabled: boolean
  cronEnabled: boolean
}

function getRuntimeName(): RuntimeEnvironmentName {
  if (process.env.VERCEL_ENV === "production") return "production"
  if (process.env.VERCEL_ENV === "preview") return "preview"
  return "development"
}

function getDeploymentUrl() {
  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) return `https://${vercelUrl}`
  return process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000"
}

function hasOptInFlag(name: string) {
  return process.env[name]?.trim() === "1"
}

/**
 * Returns the current runtime lane plus policy flags for operations that can mutate external systems.
 */
export function getRuntimeEnvironment(): RuntimeEnvironment {
  const environment = getRuntimeName()
  const isProduction = environment === "production"
  const isPreview = environment === "preview"
  const isLocal = environment === "development" && !process.env.VERCEL
  const externalSideEffectsEnabled = isProduction || hasOptInFlag("MERIDIAN_ALLOW_EXTERNAL_EFFECTS")
  const backgroundJobsEnabled = isProduction || hasOptInFlag("MERIDIAN_ALLOW_BACKGROUND_JOBS") || process.env.INNGEST_DEV === "1"

  return {
    environment,
    label: environment === "production" ? "Production" : environment === "preview" ? "Preview" : "Local development",
    deploymentUrl: getDeploymentUrl(),
    isProduction,
    isPreview,
    isLocal,
    externalSideEffectsEnabled,
    backgroundJobsEnabled,
    cronEnabled: isProduction || hasOptInFlag("MERIDIAN_ALLOW_BACKGROUND_JOBS"),
  }
}

/**
 * Reports whether this runtime may call external customer/provider systems.
 */
export function canUseExternalSideEffects() {
  return getRuntimeEnvironment().externalSideEffectsEnabled
}

/**
 * Reports whether this runtime may accept scheduled/background worker execution.
 */
export function canRunBackgroundJobs() {
  return getRuntimeEnvironment().backgroundJobsEnabled
}

/**
 * Reports whether cron polling is enabled in this runtime.
 */
export function canRunCronPolling() {
  return getRuntimeEnvironment().cronEnabled
}
