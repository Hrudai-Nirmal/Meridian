/**
 * Runnable Meridian JavaScript telemetry example.
 *
 * This script sends one synthetic workflow run using env vars so beta users can
 * verify token/node setup without editing source code.
 */
import { fileURLToPath } from "node:url"

import { createMeridian } from "../dist/index.js"

const REQUIRED_ENV = ["MERIDIAN_INGESTION_TOKEN", "MERIDIAN_NODE_ID"]

/**
 * Reads a required env var and throws a setup-focused error when it is missing.
 *
 * @param {Record<string, string | undefined>} env
 * @param {string} key
 * @returns {string}
 */
export function getRequiredEnv(env, key) {
  const value = env[key]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing ${key}.`)
  }
  return value
}

/**
 * Builds a small, bounded synthetic run payload for onboarding tests.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {import("../dist/index.js").MeridianRunPayload}
 */
export function buildSyntheticRun(env) {
  const finishedAt = new Date()
  const startedAt = new Date(finishedAt.getTime() - 1400)

  return {
    nodeId: getRequiredEnv(env, "MERIDIAN_NODE_ID"),
    externalId: env.MERIDIAN_EXTERNAL_ID || `meridian-js-example-${finishedAt.getTime()}`,
    status: "success",
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    costUsd: 0.001,
    tokens: 128,
    steps: [
      {
        name: "Prepare input",
        status: "success",
        latencyMs: 350,
        toolName: "meridian-js-example",
      },
      {
        name: "Generate response",
        status: "success",
        latencyMs: 1050,
        toolName: "meridian-js-example",
      },
    ],
  }
}

/**
 * Sends one synthetic run and returns a process-style exit code.
 *
 * @param {{
 *   env?: Record<string, string | undefined>,
 *   createClient?: typeof createMeridian,
 *   stdout?: Pick<NodeJS.WriteStream, "write">,
 *   stderr?: Pick<NodeJS.WriteStream, "write">,
 * }} options
 * @returns {Promise<number>}
 */
export async function main({
  env = process.env,
  createClient = createMeridian,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  try {
    const token = getRequiredEnv(env, "MERIDIAN_INGESTION_TOKEN")
    const payload = buildSyntheticRun(env)
    const meridian = createClient({
      token,
      baseUrl: env.MERIDIAN_BASE_URL || "https://meridian.hrudainirmal.in",
      timeoutMs: env.MERIDIAN_TIMEOUT_MS ? Number(env.MERIDIAN_TIMEOUT_MS) : 5000,
    })

    await meridian.ingestRun(payload)
    if ("flush" in meridian && typeof meridian.flush === "function") {
      await meridian.flush()
    }

    stdout.write(`Meridian telemetry test run sent for node ${payload.nodeId} with external id ${payload.externalId}.\n`)
    return 0
  } catch (error) {
    const setupHint = REQUIRED_ENV.join(" and ")
    stderr.write(`Meridian telemetry example failed. Set ${setupHint}, then retry. ${error}\n`)
    return 1
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main()
}
