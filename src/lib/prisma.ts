import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  argusGridPrisma?: PrismaClient
}

export function hasDatabaseConfig() {
  return Boolean(process.env.DATABASE_URL)
}

export function getPrisma() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database-backed ArgusGrid features.")
  }

  if (!globalForPrisma.argusGridPrisma) {
    globalForPrisma.argusGridPrisma = new PrismaClient()
  }

  return globalForPrisma.argusGridPrisma
}
