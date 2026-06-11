import { NextResponse } from "next/server"
import { z } from "zod"

import { getApiUserId, requireProjectRole } from "@/lib/api-session"
import { encryptSecret } from "@/lib/crypto"
import { getPrisma } from "@/lib/prisma"

const apiConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST"]).default("GET"),
  authType: z.enum(["NONE", "API_KEY_HEADER", "BEARER_TOKEN", "BASIC", "CUSTOM_HEADERS"]).default("NONE"),
  secretName: z.string().max(80).optional(),
  secretValue: z.string().max(5000).optional(),
  cadenceMin: z.coerce.number().int().min(1).max(1440).default(15),
  mappings: z.array(
    z.object({
      label: z.string().min(1).max(80),
      jsonPath: z.string().min(1).max(240),
      transform: z.string().max(80).optional(),
      unit: z.string().max(24).optional(),
      threshold: z.string().max(80).optional(),
      visualization: z.enum(["NUMBER", "LINE", "BAR", "TABLE", "STATUS", "HEATMAP"]).default("NUMBER"),
    })
  ),
})

export async function PUT(request: Request, context: { params: Promise<{ projectId: string; nodeId: string }> }) {
  const { error, userId } = await getApiUserId()
  if (error) return error

  const { projectId, nodeId } = await context.params
  const accessError = await requireProjectRole(userId, projectId)
  if (accessError) return accessError

  const parsed = apiConfigSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid API config payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()
  const node = await prisma.endpointNode.findFirst({ where: { id: nodeId, projectId }, select: { id: true } })

  if (!node) {
    return NextResponse.json({ error: "Node not found." }, { status: 404 })
  }

  let secretId: string | undefined
  const savedMappings: { id: string; label: string; path: string; transform: string; unit: string }[] = []
  if (parsed.data.secretValue && parsed.data.authType !== "NONE") {
    const secret = await prisma.projectSecret.create({
      data: {
        name: parsed.data.secretName || `${parsed.data.authType} credential`,
        encrypted: encryptSecret(parsed.data.secretValue),
        projectId,
      },
    })
    secretId = secret.id
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.apiEndpointConfig.upsert({
      where: { nodeId },
      update: {
        url: parsed.data.url,
        method: parsed.data.method,
        authType: parsed.data.authType,
        cadenceMin: parsed.data.cadenceMin,
        ...(secretId ? { secretId } : {}),
      },
      create: {
        nodeId,
        url: parsed.data.url,
        method: parsed.data.method,
        authType: parsed.data.authType,
        cadenceMin: parsed.data.cadenceMin,
        secretId,
      },
    })

    await transaction.visualizationConfig.deleteMany({ where: { nodeId } })
    await transaction.parameterMapping.deleteMany({ where: { nodeId } })

    for (const mapping of parsed.data.mappings) {
      const created = await transaction.parameterMapping.create({
        data: {
          label: mapping.label,
          jsonPath: mapping.jsonPath,
          transform: mapping.transform || "none",
          unit: mapping.unit || "",
          threshold: mapping.threshold ? { expression: mapping.threshold } : undefined,
          nodeId,
        },
      })
      savedMappings.push({
        id: created.id,
        label: created.label,
        path: created.jsonPath,
        transform: created.transform ?? "none",
        unit: created.unit ?? "",
      })

      await transaction.visualizationConfig.create({
        data: {
          title: mapping.label,
          kind: mapping.visualization,
          config: { mappingId: created.id },
          nodeId,
        },
      })
    }
  })

  return NextResponse.json({ ok: true, mappings: savedMappings })
}
