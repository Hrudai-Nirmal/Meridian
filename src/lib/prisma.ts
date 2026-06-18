/**
 * Shared Prisma client construction with managed Neon connection support.
 */

import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  argusGridPrisma?: PrismaClient
}

function getDatabaseUrl() {
  return process.env.NeonDB_POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL
}

/**
 * Reports whether a supported database connection is configured.
 */
export function hasDatabaseConfig() {
  return Boolean(getDatabaseUrl())
}

/**
 * Returns the process-wide Prisma client using the managed Neon URL when available.
 */
export function getPrisma() {
  const databaseUrl = getDatabaseUrl()
  if (!databaseUrl) {
    throw new Error("A database URL is required for database-backed ArgusGrid features.")
  }

  if (!globalForPrisma.argusGridPrisma) {
    globalForPrisma.argusGridPrisma = new PrismaClient({
      datasources: {
        db: { url: databaseUrl },
      },
    })
  }

  return globalForPrisma.argusGridPrisma
}
