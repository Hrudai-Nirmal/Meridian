/**
 * Secret-safe production release guard for Meridian database schema checks.
 */

import { spawn } from "node:child_process"
import { pathToFileURL } from "node:url"

const MIGRATION_NAME_PATTERN = /^\d{14}_[a-z0-9_]+$/i
const DATABASE_URL_PATTERN = /postgres(?:ql)?:\/\/\S+/gi
const NEON_PASSWORD_PATTERN = /npg_[A-Za-z0-9]+/g
const SLACK_WEBHOOK_PATTERN = /hooks\.slack\.com\/services\/\S+/gi
const BEARER_TOKEN_PATTERN = /Bearer\s+[A-Za-z0-9._~-]+/gi

/**
 * Redacts known credential shapes before release-check output is printed.
 */
export function redactReleaseOutput(value) {
  return String(value)
    .replace(DATABASE_URL_PATTERN, "[redacted-database-url]")
    .replace(NEON_PASSWORD_PATTERN, "[redacted-neon-secret]")
    .replace(SLACK_WEBHOOK_PATTERN, "[redacted-slack-webhook]")
    .replace(BEARER_TOKEN_PATTERN, "Bearer [redacted-token]")
}

/**
 * Parses `prisma migrate status` output into a release decision.
 */
export function parsePrismaMigrateStatus(output) {
  const text = String(output)
  if (/Database schema is up to date!/i.test(text)) {
    return { ok: true, pendingMigrations: [] }
  }

  const pendingMigrations = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => MIGRATION_NAME_PATTERN.test(line))

  return { ok: false, pendingMigrations }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    child.on("error", reject)
    child.on("close", (status) => {
      resolve({ status: status ?? 1, stdout, stderr })
    })
  })
}

async function main() {
  try {
    const result = await runCommand("npx", ["prisma", "migrate", "status"])
    const combinedOutput = redactReleaseOutput(`${result.stdout}\n${result.stderr}`)
    const status = parsePrismaMigrateStatus(combinedOutput)

    if (status.ok && result.status === 0) {
      process.stdout.write("Release safety check passed: database schema is up to date.\n")
      return
    }

    if (status.pendingMigrations.length) {
      process.stderr.write("Release safety check failed: pending Prisma migrations were found.\n")
      process.stderr.write(`Pending migrations: ${status.pendingMigrations.join(", ")}\n`)
      process.stderr.write("Run `npm run prisma:deploy` against the intended production database, then retry `npm run release:check`.\n")
      process.exitCode = 1
      return
    }

    process.stderr.write("Release safety check failed: Prisma migration status could not be verified.\n")
    process.stderr.write(`${combinedOutput.trim()}\n`)
    process.exitCode = 1
  } catch (error) {
    process.stderr.write("Release safety check failed before Prisma status could run.\n")
    process.stderr.write(`${redactReleaseOutput(error instanceof Error ? error.message : String(error))}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
