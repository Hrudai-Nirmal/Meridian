import { JSONPath } from "jsonpath-plus"
import { z } from "zod"

const requestSchema = z.object({
  sample: z.unknown(),
  mappings: z.array(
    z.object({
      label: z.string().min(1),
      path: z.string().min(1),
      transform: z.string().optional(),
      unit: z.string().optional(),
    })
  ),
})

export async function POST(request: Request) {
  const payload = requestSchema.safeParse(await request.json())

  if (!payload.success) {
    return Response.json({ error: "Invalid mapping payload", details: payload.error.flatten() }, { status: 400 })
  }

  const sample = payload.data.sample as string | number | boolean | object | unknown[] | null
  const extracted = payload.data.mappings.map((mapping) => {
    const value = JSONPath({ path: mapping.path, json: sample, wrap: false })

    return {
      label: mapping.label,
      path: mapping.path,
      transform: mapping.transform ?? "none",
      unit: mapping.unit ?? "",
      value,
    }
  })

  return Response.json({ ok: true, extracted })
}
