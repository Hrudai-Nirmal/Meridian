import { NextResponse } from "next/server"
import { z } from "zod"

import { authenticateIngestionRequest } from "@/lib/ingestion-tokens"
import { getPrisma } from "@/lib/prisma"

const stepSchema = z.object({
  name: z.string().min(1).max(120),
  status: z.string().min(1).max(40).transform((value) => value.toLowerCase()),
  latencyMs: z.coerce.number().int().min(0).max(24 * 60 * 60 * 1000).optional(),
  toolName: z.string().max(120).optional(),
})

const runSchema = z
  .object({
    nodeId: z.string().min(1),
    externalId: z.string().min(1).max(160).optional(),
    status: z.enum(["success", "degraded", "failed", "running", "queued"]).default("success"),
    startedAt: z.coerce.date(),
    finishedAt: z.coerce.date().optional(),
    costUsd: z.coerce.number().min(0).max(1000000).optional(),
    tokens: z.coerce.number().int().min(0).max(2147483647).optional(),
    steps: z.array(stepSchema).max(100).default([]),
  })
  .refine((value) => !value.finishedAt || value.finishedAt.getTime() >= value.startedAt.getTime(), {
    message: "finishedAt must be after startedAt.",
    path: ["finishedAt"],
  })

function toEndpointStatus(status: string) {
  return status === "failed" || status === "degraded" ? "DEGRADED" : "ACTIVE"
}

function durationMs(startedAt: Date, finishedAt?: Date | null) {
  if (!finishedAt) return null
  return Math.max(0, finishedAt.getTime() - startedAt.getTime())
}

export async function POST(request: Request) {
  const token = await authenticateIngestionRequest(request)
  if (!token) {
    return NextResponse.json({ error: "Invalid or missing ingestion token." }, { status: 401 })
  }

  const parsed = runSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workflow run payload.", details: parsed.error.flatten() }, { status: 400 })
  }

  const prisma = getPrisma()
  const node = await prisma.endpointNode.findFirst({
    where: {
      id: parsed.data.nodeId,
      projectId: token.projectId,
      project: { archivedAt: null },
    },
    select: {
      id: true,
      label: true,
    },
  })

  if (!node) {
    return NextResponse.json({ error: "Node not found for this ingestion token." }, { status: 404 })
  }

  const runData = {
    externalId: parsed.data.externalId,
    status: parsed.data.status,
    startedAt: parsed.data.startedAt,
    finishedAt: parsed.data.finishedAt ?? null,
    costUsd: parsed.data.costUsd ?? null,
    tokens: parsed.data.tokens ?? null,
    nodeId: node.id,
  }
  const stepData = parsed.data.steps.map((step) => ({
    name: step.name,
    status: step.status,
    latencyMs: step.latencyMs ?? null,
    toolName: step.toolName ?? null,
  }))
  const endpointStatus = toEndpointStatus(parsed.data.status)
  const finishedCopy = parsed.data.finishedAt ? ` in ${durationMs(parsed.data.startedAt, parsed.data.finishedAt)}ms` : ""
  const statusReason = `Latest run ${parsed.data.status}${finishedCopy} at ${new Date().toISOString()}.`

  const result = await prisma.$transaction(async (transaction) => {
    const run = parsed.data.externalId
      ? await transaction.workflowRun.upsert({
          where: {
            nodeId_externalId: {
              nodeId: node.id,
              externalId: parsed.data.externalId,
            },
          },
          update: {
            ...runData,
            steps: {
              deleteMany: {},
              create: stepData,
            },
          },
          create: {
            ...runData,
            steps: {
              create: stepData,
            },
          },
          include: { steps: true },
        })
      : await transaction.workflowRun.create({
          data: {
            ...runData,
            steps: {
              create: stepData,
            },
          },
          include: { steps: true },
        })

    await transaction.endpointNode.update({
      where: { id: node.id },
      data: {
        status: endpointStatus,
        statusReason,
      },
    })

    return run
  })

  return NextResponse.json({
    ok: true,
    run: {
      id: result.id,
      externalId: result.externalId,
      nodeId: result.nodeId,
      status: result.status,
      startedAt: result.startedAt.toISOString(),
      finishedAt: result.finishedAt?.toISOString() ?? null,
      durationMs: durationMs(result.startedAt, result.finishedAt),
      costUsd: result.costUsd?.toString() ?? null,
      tokens: result.tokens,
      stepCount: result.steps.length,
    },
  })
}
