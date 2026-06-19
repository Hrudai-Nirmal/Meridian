/**
 * Safe application build metadata for readiness and release diagnostics.
 */
import "server-only"

import packageJson from "../../package.json"

export type AppBuildMetadata = {
  version: string
  commitSha: string
  buildTime: string | null
  environment: string
}

function safeValue(value: string | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : fallback
}

/**
 * Returns non-secret build metadata for health checks and operator readiness UI.
 */
export function getAppBuildMetadata(): AppBuildMetadata {
  return {
    version: packageJson.version,
    commitSha: safeValue(process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA, "local"),
    buildTime: process.env.MERIDIAN_BUILD_TIME?.trim() || process.env.ARGUSGRID_BUILD_TIME?.trim() || null,
    environment: safeValue(process.env.VERCEL_ENV ?? process.env.NODE_ENV, "development"),
  }
}
