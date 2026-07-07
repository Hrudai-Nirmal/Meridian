export type ApiAuthType = "NONE" | "API_KEY_HEADER" | "BEARER_TOKEN" | "BASIC" | "CUSTOM_HEADERS"

export function validateApiAuthConfig(config: {
  authType: ApiAuthType | string
  authHeaderName?: string | null
  secretValue?: string | null
}): { ok: true } | { ok: false; error: string }

export function buildApiAuthHeaderEntries(config: {
  authType: ApiAuthType | string
  authHeaderName?: string | null
  secretValue?: string | null
}): { ok: true; headers: [string, string][] } | { ok: false; error: string }

export function getStoredAuthHeaderName(headersJson: unknown): string
