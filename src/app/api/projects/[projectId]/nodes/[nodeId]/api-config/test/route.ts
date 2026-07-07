import { JSONPath } from "jsonpath-plus"
import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { buildApiAuthHeaderEntries } from "@/lib/api-auth-headers.mjs"

type JsonDocument = string | number | boolean | object | unknown[] | null

const testSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST"]).default("GET"),
  authType: z.enum(["NONE", "API_KEY_HEADER", "BEARER_TOKEN", "BASIC", "CUSTOM_HEADERS"]).default("NONE"),
  authHeaderName: z.string().max(120).optional(),
  secretValue: z.string().max(5000).optional(),
  mappings: z.array(
    z.object({
      label: z.string().min(1).max(80),
      jsonPath: z.string().min(1).max(240),
      transform: z.string().max(80).optional(),
      unit: z.string().max(24).optional(),
      threshold: z.string().max(80).optional(),
    })
  ),
})

function applyTransform(value: unknown, transform?: string) {
  if (!transform || transform === "none") return value
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) return value

  if (transform.startsWith("divide:")) {
    const divisor = Number(transform.split(":")[1])
    return divisor ? numeric / divisor : numeric
  }

  if (transform.startsWith("round:")) {
    const decimals = Number(transform.split(":")[1] ?? 0)
    const factor = 10 ** decimals
    return Math.round(numeric * factor) / factor
  }

  if (transform === "percent") return numeric * 100
  return value
}

function thresholdPreview(value: unknown, threshold?: string) {
  if (!threshold) return { configured: false, crossed: false, message: "No threshold configured." }
  const numeric = typeof value === "number" ? value : Number(value)
  const match = threshold.trim().match(/^(>=|>|<=|<|=)\s*(-?\d+(\.\d+)?)$/)
  if (!Number.isFinite(numeric) || !match) {
    return { configured: true, crossed: false, message: "Threshold needs a numeric value and an expression like > 90." }
  }

  const target = Number(match[2])
  const crossed =
    (match[1] === ">" && numeric > target) ||
    (match[1] === ">=" && numeric >= target) ||
    (match[1] === "<" && numeric < target) ||
    (match[1] === "<=" && numeric <= target) ||
    (match[1] === "=" && numeric === target)

  return { configured: true, crossed, message: crossed ? "Would create an alert." : "Within threshold." }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string; nodeId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId } = await context.params
  const accessError = await requireProjectRole(userId, projectId)
  if (accessError) return accessError

  const parsed = testSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid endpoint test payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const authHeaders = buildApiAuthHeaderEntries(parsed.data)
  if (!authHeaders.ok) {
    return NextResponse.json({ ok: false, error: authHeaders.error }, { status: 400 })
  }

  const headers = new Headers(authHeaders.headers)

  try {
    const response = await fetch(parsed.data.url, {
      method: parsed.data.method,
      headers,
      signal: AbortSignal.timeout(10000),
    })
    const text = await response.text()
    const contentType = response.headers.get("content-type") ?? "unknown"
    let json: JsonDocument
    let parsedJson = true

    try {
      json = text ? (JSON.parse(text) as JsonDocument) : {}
    } catch {
      parsedJson = false
      json = { body: text }
    }

    const mappings = parsed.data.mappings.map((mapping) => {
      try {
        const rawValue = JSONPath({ path: mapping.jsonPath, json, wrap: false })
        const value = applyTransform(rawValue, mapping.transform)
        return {
          label: mapping.label,
          jsonPath: mapping.jsonPath,
          ok: rawValue !== undefined,
          rawValue,
          value,
          unit: mapping.unit ?? "",
          threshold: thresholdPreview(value, mapping.threshold),
        }
      } catch (mappingError) {
        return {
          label: mapping.label,
          jsonPath: mapping.jsonPath,
          ok: false,
          error: mappingError instanceof Error ? mappingError.message : "JSONPath failed.",
        }
      }
    })

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      contentType,
      parsedJson,
      preview: json,
      mappings,
    })
  } catch (testError) {
    return NextResponse.json(
      { ok: false, error: testError instanceof Error ? testError.message : "Endpoint test failed." },
      { status: 502 }
    )
  }
}
