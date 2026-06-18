/**
 * Secret-safe structured logging for server-side operational failures.
 */

import "server-only"

import { randomUUID } from "node:crypto"

export type OperationalErrorCode =
  | "DATABASE_UNREACHABLE"
  | "DATABASE_AUTH_FAILED"
  | "DATABASE_SCHEMA_MISMATCH"
  | "DATABASE_UNAVAILABLE"
  | "AUTH_SESSION_UNAVAILABLE"
  | "INTERNAL_OPERATION_FAILED"

type LogContext = Record<string, boolean | number | string | null | undefined>

const SENSITIVE_KEY_PATTERN = /secret|token|password|credential|authorization|cookie|url/i

function getErrorDetails(error: unknown) {
  const candidate = error && typeof error === "object" ? error as { code?: unknown; message?: unknown; name?: unknown } : null
  const prismaCode = typeof candidate?.code === "string" ? candidate.code : null
  const errorName = typeof candidate?.name === "string" ? candidate.name : "UnknownError"
  const message = typeof candidate?.message === "string" ? candidate.message : String(error)

  if (prismaCode === "P1001" || message.includes("Can't reach database server")) {
    return { code: "DATABASE_UNREACHABLE" as const, errorName, prismaCode }
  }
  if (prismaCode === "P1000" || message.includes("Authentication failed against database server")) {
    return { code: "DATABASE_AUTH_FAILED" as const, errorName, prismaCode }
  }
  if (["P2021", "P2022"].includes(prismaCode ?? "")) {
    return { code: "DATABASE_SCHEMA_MISMATCH" as const, errorName, prismaCode }
  }

  return { code: "INTERNAL_OPERATION_FAILED" as const, errorName, prismaCode }
}

function sanitizeLogContext(context: LogContext) {
  return Object.fromEntries(
    Object.entries(context)
      .filter(([key, value]) => value !== undefined && !SENSITIVE_KEY_PATTERN.test(key))
      .map(([key, value]) => [key, value])
  )
}

/**
 * Returns whether an error is a known database availability or schema failure.
 */
export function isDatabaseOperationalError(error: unknown) {
  return getErrorDetails(error).code.startsWith("DATABASE_")
}

/**
 * Emits a structured error without raw messages, stack traces, URLs, or secrets.
 */
export function logServerError(event: string, error: unknown, context: LogContext = {}) {
  const incidentId = randomUUID()
  const details = getErrorDetails(error)

  console.error(JSON.stringify({
    level: "error",
    event,
    incidentId,
    errorCode: details.code,
    errorName: details.errorName,
    prismaCode: details.prismaCode,
    timestamp: new Date().toISOString(),
    ...sanitizeLogContext(context),
  }))

  return { incidentId, errorCode: details.code }
}
