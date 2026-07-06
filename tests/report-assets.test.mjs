import assert from "node:assert/strict"
import { test } from "node:test"

import {
  decodeReportAsset,
  MAX_BRAND_IMAGE_BYTES,
  MAX_MAP_IMAGE_BYTES,
} from "../src/lib/report-assets.mjs"

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function dataUrl(mimeType, payload) {
  return `data:${mimeType};base64,${Buffer.from(payload).toString("base64")}`
}

test("decodeReportAsset accepts valid map PNGs within the map limit", () => {
  const result = decodeReportAsset({
    asset: { mimeType: "image/png", dataUrl: dataUrl("image/png", Buffer.concat([PNG_HEADER, Buffer.from("map")])) },
    allowedMimeTypes: ["image/png"],
    maxBytes: MAX_MAP_IMAGE_BYTES,
    label: "Map attachment",
  })

  assert.equal(result.error, null)
  assert.equal(result.data?.subarray(0, 8).equals(PNG_HEADER), true)
  assert.equal(result.mimeType, "image/png")
})

test("decodeReportAsset accepts valid brand SVGs within the brand limit", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><text x="4" y="24">Meridian</text></svg>'
  const result = decodeReportAsset({
    asset: { mimeType: "image/svg+xml", dataUrl: dataUrl("image/svg+xml", svg) },
    allowedMimeTypes: ["image/png", "image/svg+xml"],
    maxBytes: MAX_BRAND_IMAGE_BYTES,
    label: "Brand image",
  })

  assert.equal(result.error, null)
  assert.equal(result.data?.toString("utf8"), svg)
  assert.equal(result.mimeType, "image/svg+xml")
})

test("decodeReportAsset rejects oversized assets", () => {
  const result = decodeReportAsset({
    asset: { mimeType: "image/png", dataUrl: dataUrl("image/png", Buffer.alloc(MAX_BRAND_IMAGE_BYTES + 1)) },
    allowedMimeTypes: ["image/png"],
    maxBytes: MAX_BRAND_IMAGE_BYTES,
    label: "Brand image",
  })

  assert.equal(result.data, null)
  assert.equal(result.error, "Brand image must be 256KB or smaller.")
})

test("decodeReportAsset rejects active SVG content", () => {
  const result = decodeReportAsset({
    asset: { mimeType: "image/svg+xml", dataUrl: dataUrl("image/svg+xml", '<svg><script>alert("x")</script></svg>') },
    allowedMimeTypes: ["image/svg+xml"],
    maxBytes: MAX_BRAND_IMAGE_BYTES,
    label: "Brand image",
  })

  assert.equal(result.data, null)
  assert.equal(result.error, "Brand image SVG cannot contain scripts, event handlers, foreignObject, or external references.")
})
