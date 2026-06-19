/**
 * Server-side helpers for recording secret-safe operational evidence.
 */
import "server-only"

import type { Prisma, PrismaClient } from "@prisma/client"

const BLOCKED_METADATA_PARTS = ["token", "secret", "password", "credential", "encrypted", "key", "authorization"]

type AuditMetadata = Record<string, unknown>

type CreateAuditLogInput = {
  action: string
  entity: string
  entityId?: string | null
  organizationId?: string | null
  projectId?: string | null
  userId?: string | null
  metadata?: AuditMetadata | null
}

function isPlainObject(value: unknown): value is AuditMetadata {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isBlockedMetadataKey(key: string) {
  const normalized = key.toLowerCase()
  return BLOCKED_METADATA_PARTS.some((part) => normalized.includes(part))
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(sanitizeMetadataValue).filter((item) => item !== undefined)
  if (!isPlainObject(value)) return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isBlockedMetadataKey(key))
      .map(([key, nestedValue]) => [key, sanitizeMetadataValue(nestedValue)])
      .filter(([, nestedValue]) => nestedValue !== undefined)
  )
}

/**
 * Writes an AuditLog row after a user-visible operational action succeeds.
 */
export async function createAuditLog(prisma: PrismaClient | Prisma.TransactionClient, input: CreateAuditLogInput) {
  if (!input.organizationId && !input.projectId) {
    throw new Error("Audit logs require an organizationId or projectId.")
  }

  const [project, actor] = await Promise.all([
    input.projectId && !input.organizationId
      ? prisma.project.findUnique({
          where: { id: input.projectId },
          select: { organizationId: true },
        })
      : null,
    input.userId
      ? prisma.user.findUnique({
          where: { id: input.userId },
          select: { id: true, name: true, email: true },
        })
      : null,
  ])

  const organizationId = input.organizationId ?? project?.organizationId
  if (!organizationId) {
    throw new Error("Unable to resolve organization for audit log.")
  }

  const metadata = sanitizeMetadataValue({
    ...(input.metadata ?? {}),
    actor: actor
      ? {
          id: actor.id,
          name: actor.name,
          email: actor.email,
        }
      : null,
  }) as Prisma.InputJsonValue

  await prisma.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      organizationId,
      projectId: input.projectId ?? null,
      metadata,
    },
  })
}

/**
 * Converts arbitrary metadata into a safe object for API responses.
 */
export function sanitizeAuditMetadata(metadata: unknown): AuditMetadata | null {
  const sanitized = sanitizeMetadataValue(metadata)
  return isPlainObject(sanitized) ? sanitized : null
}
