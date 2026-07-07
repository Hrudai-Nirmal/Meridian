const DEFAULT_HELP_FIELD = "overview"

export const API_SETUP_FIELD_HELP = {
  overview: {
    title: "API setup guide",
    description:
      "Focus a field on the left to see what Meridian expects, why it matters, and safe examples. Use this setup when Meridian should poll an endpoint and store metric samples.",
    examples: ["GET https://your-service.com/api/health", "Map $.summary.success_rate into a Success rate metric."],
  },
  endpointUrl: {
    title: "Endpoint URL",
    description: "The deployed HTTP endpoint Meridian should poll. It should return JSON so mappings can extract metric values.",
    examples: ["https://your-service.com/api/health", "https://api.vendor.com/workflows/status"],
  },
  authType: {
    title: "Auth type",
    description:
      "Choose how Meridian authenticates with the endpoint. Selecting any auth type requires an auth header and a secret value.",
    examples: ["No auth for public health endpoints.", "Bearer token for APIs that expect Authorization: Bearer <token>."],
  },
  authHeaderName: {
    title: "Auth header",
    description: "The HTTP header name Meridian should send with the encrypted secret value during tests and scheduled polling.",
    examples: ["Authorization", "x-api-key", "x-tenant-token"],
  },
  secretValue: {
    title: "Secret value",
    description:
      "The private token, API key, or encoded credential value for the selected auth type. Meridian encrypts it before storing and never shows it again.",
    examples: ["Bearer token: paste only the token; Meridian adds Bearer.", "Basic auth: paste the base64 username:password value."],
  },
  customHeaders: {
    title: "Custom headers",
    description:
      "Use this when an API expects a vendor-specific header name instead of standard Authorization. Meridian sends one custom header with your secret value.",
    examples: ["x-tenant-token: <secret value>", "x-api-key: <secret value>"],
  },
  cadenceMin: {
    title: "Poll cadence",
    description: "How often Meridian should check this endpoint after the setup is saved. The scheduler only polls when the cadence is due.",
    examples: ["15 means every 15 minutes.", "Use a slower cadence for expensive vendor APIs."],
  },
  mappingLabel: {
    title: "Metric label",
    description: "The human-readable name for the value Meridian extracts. This label appears on cards, charts, alerts, and reports.",
    examples: ["Success rate", "Avg latency", "Token usage", "Quality score"],
  },
  unit: {
    title: "Unit",
    description: "A short suffix that explains the metric value. Keep it compact so cards and reports stay readable.",
    examples: ["%", "ms", "tokens", "score", "USD"],
  },
  jsonPath: {
    title: "JSONPath",
    description: "The path that tells Meridian where Meridian should read the metric value from the endpoint's JSON response.",
    examples: ["$.value", "$.summary.success_rate", "$.usage.total_tokens", "$.latency.p95_ms"],
  },
  transform: {
    title: "Transform",
    description: "Optional numeric cleanup before Meridian stores the value. Leave blank or use none when the API already returns the display value.",
    examples: ["none", "percent turns 0.982 into 98.2", "round:1", "divide:1000"],
  },
  threshold: {
    title: "Threshold",
    description: "An optional numeric condition Meridian can preview and use for alerts.",
    examples: ["> 3000 for latency in ms", "< 95 for success rate", ">= 100"],
  },
  visualization: {
    title: "Visualization",
    description: "How Meridian should display this mapped metric. Number is best for a single primary metric.",
    examples: ["Number for score/current value.", "Line for trend-heavy metrics.", "Status for pass/fail signals."],
  },
  testEndpoint: {
    title: "Test endpoint",
    description:
      "Calls the endpoint immediately with the current fields and previews HTTP status, response JSON, mapped values, transforms, and threshold results.",
    examples: ["Use this before saving.", "A 400 response usually means field validation; a 502 usually means the remote endpoint failed."],
  },
  saveSetup: {
    title: "Save API setup",
    description:
      "Stores the endpoint, auth settings, encrypted secret, mapping, visualization, and cadence so scheduled polling can create metric samples.",
    examples: ["Secrets are encrypted before storage.", "Saved mappings power charts, alerts, and reports."],
  },
}

export function getApiSetupFieldHelp(field) {
  return API_SETUP_FIELD_HELP[field] ?? API_SETUP_FIELD_HELP[DEFAULT_HELP_FIELD]
}

export function getAuthHeaderPlaceholder(authType) {
  if (authType === "BEARER_TOKEN" || authType === "BASIC") return "Authorization"
  if (authType === "API_KEY_HEADER") return "x-api-key"
  if (authType === "CUSTOM_HEADERS") return "x-tenant-token"
  return "Header name"
}
