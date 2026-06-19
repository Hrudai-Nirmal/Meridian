import "server-only"

import { createHash, randomBytes } from "crypto"

import { getPrisma } from "@/lib/prisma"

const TOKEN_PREFIX_LENGTH = 14

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

/** Creates a cryptographically random Meridian ingestion token. */
export function createRawIngestionToken() {
  return `mdn_${randomBytes(32).toString("base64url")}`
}

/** Returns the non-secret token prefix stored for operator identification. */
export function tokenPrefix(token: string) {
  return token.slice(0, TOKEN_PREFIX_LENGTH)
}

/** Creates and persists a project-scoped ingestion token. */
export async function createIngestionToken(input: { projectId: string; userId: string; name: string }) {
  const prisma = getPrisma()
  const token = createRawIngestionToken()
  const created = await prisma.ingestionToken.create({
    data: {
      name: input.name,
      prefix: tokenPrefix(token),
      tokenHash: hashToken(token),
      projectId: input.projectId,
      createdById: input.userId,
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  })

  return {
    token,
    tokenRecord: {
      ...created,
      createdAt: created.createdAt.toISOString(),
      lastUsedAt: created.lastUsedAt?.toISOString() ?? null,
      revokedAt: created.revokedAt?.toISOString() ?? null,
    },
  }
}

/** Extracts a token from canonical or legacy authentication headers. */
export function tokenFromRequest(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  return bearer || request.headers.get("x-meridian-token")?.trim() || request.headers.get("x-argusgrid-token")?.trim() || null
}

/** Authenticates an ingestion request and records successful token use. */
export async function authenticateIngestionRequest(request: Request) {
  const token = tokenFromRequest(request)
  if (!token) return null

  const prisma = getPrisma()
  const tokenRecord = await prisma.ingestionToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      projectId: true,
      revokedAt: true,
    },
  })

  if (!tokenRecord || tokenRecord.revokedAt) return null

  await prisma.ingestionToken.update({
    where: { id: tokenRecord.id },
    data: { lastUsedAt: new Date() },
  })

  return {
    id: tokenRecord.id,
    projectId: tokenRecord.projectId,
  }
}
