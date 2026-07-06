/*
 * Secret-safe report attachment validation for generated map PNGs and optional
 * client-facing brand images stored with report shares.
 */

export const MAX_MAP_IMAGE_BYTES = 2 * 1024 * 1024
export const MAX_BRAND_IMAGE_BYTES = 256 * 1024

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const EXTERNAL_REFERENCE_PATTERN = /\b(?:href|xlink:href)\s*=\s*["'](?:https?:|data:|\/\/)/i
const EVENT_HANDLER_PATTERN = /\son[a-z]+\s*=/i

/**
 * Decode and validate an optional report image data URL.
 *
 * @param {{ asset?: { mimeType: string, dataUrl: string }, allowedMimeTypes: string[], maxBytes: number, label: string }} input
 * @returns {{ data: Buffer | null, mimeType: string | null, error: string | null }}
 */
export function decodeReportAsset({ asset, allowedMimeTypes, maxBytes, label }) {
  if (!asset) return { data: null, mimeType: null, error: null }
  if (!allowedMimeTypes.includes(asset.mimeType)) {
    return { data: null, mimeType: null, error: `${label} must be ${formatAllowedMimeTypes(allowedMimeTypes)}.` }
  }

  const base64MimeType = asset.mimeType.replaceAll("+", "\\+")
  const match = asset.dataUrl.match(new RegExp(`^data:${base64MimeType};base64,([a-zA-Z0-9+/=]+)$`))
  if (!match) {
    return { data: null, mimeType: null, error: `${label} must be a valid ${formatAllowedMimeTypes(allowedMimeTypes)} data URL.` }
  }

  const data = Buffer.from(match[1], "base64")
  if (data.byteLength > maxBytes) {
    return { data: null, mimeType: null, error: `${label} must be ${formatBytes(maxBytes)} or smaller.` }
  }

  if (asset.mimeType === "image/png" && !data.subarray(0, 8).equals(PNG_HEADER)) {
    return { data: null, mimeType: null, error: `${label} must be a valid PNG image.` }
  }

  if (asset.mimeType === "image/svg+xml" && !isSafeSvg(data.toString("utf8"))) {
    return {
      data: null,
      mimeType: null,
      error: `${label} SVG cannot contain scripts, event handlers, foreignObject, or external references.`,
    }
  }

  return { data, mimeType: asset.mimeType, error: null }
}

function formatAllowedMimeTypes(allowedMimeTypes) {
  return allowedMimeTypes
    .map((mimeType) => {
      if (mimeType === "image/png") return "PNG"
      if (mimeType === "image/svg+xml") return "SVG"
      return mimeType
    })
    .join(" or ")
}

function formatBytes(bytes) {
  if (bytes % (1024 * 1024) === 0) return `${bytes / (1024 * 1024)}MB`
  if (bytes % 1024 === 0) return `${bytes / 1024}KB`
  return `${bytes} bytes`
}

function isSafeSvg(svg) {
  const normalized = svg.toLowerCase()
  return (
    normalized.includes("<svg") &&
    !normalized.includes("<script") &&
    !normalized.includes("<foreignobject") &&
    !EVENT_HANDLER_PATTERN.test(svg) &&
    !EXTERNAL_REFERENCE_PATTERN.test(svg)
  )
}
