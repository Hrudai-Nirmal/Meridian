const AUTH_TYPES_REQUIRING_SECRET = new Set(["API_KEY_HEADER", "BEARER_TOKEN", "BASIC", "CUSTOM_HEADERS"])
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/

/**
 * @typedef {"NONE" | "API_KEY_HEADER" | "BEARER_TOKEN" | "BASIC" | "CUSTOM_HEADERS"} ApiAuthType
 * @typedef {{ authType: ApiAuthType | string, authHeaderName?: string | null, secretValue?: string | null }} ApiAuthConfig
 * @typedef {{ ok: true } | { ok: false, error: string }} ValidationResult
 * @typedef {{ ok: true, headers: [string, string][] } | { ok: false, error: string }} HeaderBuildResult
 */

function normalizeAuthType(authType) {
  return String(authType || "NONE").toUpperCase()
}

function normalizeHeaderName(authHeaderName) {
  return String(authHeaderName ?? "").trim()
}

function normalizeSecretValue(secretValue) {
  return String(secretValue ?? "").trim()
}

function isAuthenticatedAuthType(authType) {
  return AUTH_TYPES_REQUIRING_SECRET.has(normalizeAuthType(authType))
}

/**
 * Returns whether an API auth configuration has the fields needed to make a request.
 *
 * @param {ApiAuthConfig} config
 * @returns {ValidationResult}
 */
export function validateApiAuthConfig(config) {
  const authType = normalizeAuthType(config.authType)
  if (!isAuthenticatedAuthType(authType)) return { ok: true }

  const authHeaderName = normalizeHeaderName(config.authHeaderName)
  const secretValue = normalizeSecretValue(config.secretValue)

  if (!authHeaderName) {
    return { ok: false, error: "Auth header is required when an auth type is selected." }
  }

  if (!HEADER_NAME_PATTERN.test(authHeaderName)) {
    return { ok: false, error: "Auth header must be a valid HTTP header name, such as Authorization or x-api-key." }
  }

  if (!secretValue) {
    return { ok: false, error: "Secret value is required when an auth type is selected." }
  }

  return { ok: true }
}

/**
 * Builds safe HTTP headers for an API endpoint auth configuration.
 *
 * @param {ApiAuthConfig} config
 * @returns {HeaderBuildResult}
 */
export function buildApiAuthHeaderEntries(config) {
  const validation = validateApiAuthConfig(config)
  if (!validation.ok) return validation

  const authType = normalizeAuthType(config.authType)
  if (!isAuthenticatedAuthType(authType)) return { ok: true, headers: [] }

  const authHeaderName = normalizeHeaderName(config.authHeaderName)
  const secretValue = normalizeSecretValue(config.secretValue)

  if (authType === "BEARER_TOKEN") return { ok: true, headers: [[authHeaderName, `Bearer ${secretValue}`]] }
  if (authType === "BASIC") return { ok: true, headers: [[authHeaderName, `Basic ${secretValue}`]] }
  return { ok: true, headers: [[authHeaderName, secretValue]] }
}

/**
 * Reads the persisted auth header name from ApiEndpointConfig.headersJson.
 *
 * @param {unknown} headersJson
 * @returns {string}
 */
export function getStoredAuthHeaderName(headersJson) {
  if (!headersJson || typeof headersJson !== "object" || Array.isArray(headersJson)) return ""
  const value = headersJson.authHeaderName
  return typeof value === "string" ? value : ""
}
