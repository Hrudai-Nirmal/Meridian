/*
 * Reader-safe metadata formatting for operational UI surfaces.
 */

/**
 * Format a bounded metadata object for compact Logs rows.
 *
 * @param {Record<string, unknown> | null | undefined} metadata
 * @returns {string}
 */
export function formatSafeMetadata(metadata) {
  if (!metadata) return ""
  return Object.entries(metadata)
    .map(([key, value]) => [key, formatMetadataValue(value)])
    .filter(([, value]) => value !== null && value !== "")
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" | ")
}

function formatMetadataValue(value) {
  if (value === null || value === undefined || value === "") return null
  if (Array.isArray(value)) return value.map(formatMetadataValue).filter(Boolean).join(", ")
  if (typeof value === "object") return formatMetadataObject(value)
  return String(value)
}

function formatMetadataObject(value) {
  const record = value
  const name = typeof record.name === "string" ? record.name : null
  const email = typeof record.email === "string" ? record.email : null
  const label = typeof record.label === "string" ? record.label : null

  if (name && email) return `${name} <${email}>`
  if (name) return name
  if (email) return email
  if (label) return label
  return null
}
