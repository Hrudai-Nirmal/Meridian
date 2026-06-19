/**
 * Shared Prisma client construction with managed Neon connection support.
 */

import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  meridianPrisma?: PrismaClient
}

function getDatabaseUrl() {
  return process.env.NeonDB_POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL
}

/**
 * Identifies the active connection source without exposing its value.
 */
export function getDatabaseConnectionSource() {
  if (process.env.NeonDB_POSTGRES_PRISMA_URL) return "managed-neon"
  if (process.env.DATABASE_URL) return "database-url"
  return "unconfigured"
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
    throw new Error("A database URL is required for database-backed Meridian features.")
  }

  if (!globalForPrisma.meridianPrisma) {
    globalForPrisma.meridianPrisma = new PrismaClient({
      datasources: {
        db: { url: databaseUrl },
      },
    })
  }

  return globalForPrisma.meridianPrisma
}
