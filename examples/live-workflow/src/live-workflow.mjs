#!/usr/bin/env node
/**
 * Live Meridian workflow telemetry demo.
 *
 * The demo simulates a support triage automation and sends one run to Meridian
 * through the published JavaScript SDK. Secrets are read from environment
 * variables and are never printed.
 */
import { fileURLToPath } from "node:url"

const REQUIRED_ENV = ["MERIDIAN_INGESTION_TOKEN", "MERIDIAN_NODE_ID"]
const DEFAULT_BASE_URL = "https://meridian.hrudainirmal.in"
const VALID_MODES = new Set(["success", "degraded", "failed"])

const workflowProfiles = {
  success: {
    status: "success",
    costUsd: 0.021,
    tokens: 1480,
    totalLatencyMs: 3580,
  },
  degraded: {
    status: "degraded",
    costUsd: 0.026,
    tokens: 1660,
    totalLatencyMs: 6420,
  },
  failed: {
    status: "failed",
    costUsd: 0.014,
    tokens: 920,
    totalLatencyMs: 2860,
  },
}

function requireEnv(env, key) {
  const value = env[key]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing ${key}.`)
  }
  return value
}

export function normalizeDemoMode(value) {
  const mode = value || "success"
  if (!VALID_MODES.has(mode)) {
    throw new Error("MERIDIAN_DEMO_MODE must be one of success, degraded, or failed.")
  }
  return mode
}

export function buildWorkflowRunPayload({ nodeId, mode = "success", now = new Date() }) {
  const normalizedMode = normalizeDemoMode(mode)
  const profile = workflowProfiles[normalizedMode]
  const startedAt = new Date(now.getTime() - profile.totalLatencyMs)
  const contextStatus = normalizedMode === "degraded" ? "degraded" : "success"
  const draftStatus = normalizedMode === "failed" ? "failed" : "success"
  const handoffStatus = normalizedMode === "failed" ? "queued" : "success"

  return {
    nodeId,
    externalId: `support-triage-${normalizedMode}-${now.getTime()}`,
    status: profile.status,
    startedAt: startedAt.toISOString(),
    finishedAt: now.toISOString(),
    costUsd: profile.costUsd,
    tokens: profile.tokens,
    steps: [
      {
        name: "Receive request",
        status: "success",
        latencyMs: 180,
        toolName: "inbox-webhook",
      },
      {
        name: "Classify intent",
        status: "success",
        latencyMs: 520,
        toolName: "intent-classifier",
      },
      {
        name: "Retrieve account context",
        status: contextStatus,
        latencyMs: normalizedMode === "degraded" ? 3600 : 820,
        toolName: "crm-lookup",
      },
      {
        name: "Draft response",
        status: draftStatus,
        latencyMs: normalizedMode === "failed" ? 1160 : 1540,
        toolName: "support-agent",
      },
      {
        name: "Complete handoff",
        status: handoffStatus,
        latencyMs: 520,
        toolName: "ticketing-system",
      },
    ],
  }
}

export function formatSuccessMessage(payload) {
  return [
    "Meridian live workflow demo sent.",
    `Node: ${payload.nodeId}`,
    `Status: ${payload.status}`,
    `External ID: ${payload.externalId}`,
    `Steps: ${payload.steps.length}`,
  ].join("\n")
}

export async function createPublishedSdkClient(options) {
  const { createMeridian } = await import("@meridian-workflows/sdk")
  return createMeridian(options)
}

export async function main({
  env = process.env,
  createClient = createPublishedSdkClient,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  try {
    const token = requireEnv(env, "MERIDIAN_INGESTION_TOKEN")
    const nodeId = requireEnv(env, "MERIDIAN_NODE_ID")
    const mode = normalizeDemoMode(env.MERIDIAN_DEMO_MODE)
    const payload = buildWorkflowRunPayload({ nodeId, mode })
    const meridian = await createClient({
      token,
      baseUrl: env.MERIDIAN_BASE_URL || DEFAULT_BASE_URL,
      timeoutMs: 8000,
    })

    await meridian.ingestRun(payload)
    if ("flush" in meridian && typeof meridian.flush === "function") {
      await meridian.flush()
    }

    stdout.write(`${formatSuccessMessage(payload, token)}\n`)
    return 0
  } catch (error) {
    stderr.write(
      [
        "Meridian live workflow demo failed.",
        `Set ${REQUIRED_ENV.join(" and ")} before running.`,
        "Optional: MERIDIAN_DEMO_MODE=success|degraded|failed.",
        String(error),
      ].join("\n") + "\n",
    )
    return 1
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main()
}
