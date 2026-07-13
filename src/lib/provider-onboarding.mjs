/**
 * Provider-specific onboarding copy for telemetry first-signal flows. These
 * helpers keep Integrations copy consistent without storing or exposing tokens.
 */

const PROVIDER_COPY = {
  dify: {
    providerName: "Dify",
    configureTitle: "Configure Dify",
    runTitle: "Run Dify once",
    signalReceivedLabel: "Real Dify run received",
    awaitingSignalLabel: "Awaiting Dify run",
    setupInstruction: "Paste the Code-node and HTTP Request-node settings into Dify, then run the workflow once.",
  },
  n8n: {
    providerName: "n8n",
    configureTitle: "Configure n8n",
    runTitle: "Run n8n once",
    signalReceivedLabel: "Real n8n run received",
    awaitingSignalLabel: "Awaiting n8n run",
    setupInstruction: "Add an HTTP Request node after the workflow completes, then execute the workflow once.",
  },
  "github-actions": {
    providerName: "GitHub Actions",
    configureTitle: "Configure GitHub Actions",
    runTitle: "Run GitHub Actions workflow",
    signalReceivedLabel: "GitHub Actions run received",
    awaitingSignalLabel: "Awaiting GitHub Actions run",
    setupInstruction: "Store the token as a GitHub secret, add the final reporting step, then run the workflow.",
  },
  "javascript-sdk": {
    providerName: "JavaScript SDK",
    configureTitle: "Install JavaScript SDK",
    runTitle: "Run SDK test",
    signalReceivedLabel: "SDK run received",
    awaitingSignalLabel: "Awaiting SDK run",
    setupInstruction: "Install the published package, set the environment variables, and run the SDK test command.",
  },
}

const DEFAULT_PROVIDER_COPY = {
  providerName: "Provider",
  configureTitle: "Configure provider",
  runTitle: "Run once",
  signalReceivedLabel: "Real run received",
  awaitingSignalLabel: "Awaiting run",
  setupInstruction: "Configure the provider, send one run, and refresh Meridian evidence.",
}

/**
 * @typedef {keyof PROVIDER_COPY} ProviderId
 * @typedef {object} ProviderOnboardingCopy
 * @property {string} providerName
 * @property {string} configureTitle
 * @property {string} runTitle
 * @property {string} signalReceivedLabel
 * @property {string} awaitingSignalLabel
 * @property {string} setupInstruction
 * @typedef {"select-node" | "create-token" | "send-first-run" | "run-received"} ProviderFirstSignalStage
 * @typedef {object} ProviderFirstSignalStatus
 * @property {ProviderFirstSignalStage} stage
 * @property {string} badge
 * @property {string} title
 * @property {string} detail
 * @property {string} primaryAction
 */

/**
 * Returns display copy for a telemetry provider.
 *
 * @param {string} providerId
 * @returns {ProviderOnboardingCopy}
 */
export function getProviderOnboardingCopy(providerId) {
  return PROVIDER_COPY[providerId] ?? DEFAULT_PROVIDER_COPY
}

/**
 * Builds the selected provider's first-signal state from safe local evidence.
 *
 * @param {{
 *   providerId: string,
 *   hasSelectedNode: boolean,
 *   hasToken: boolean,
 *   hasRun: boolean,
 *   latestRun?: { externalId?: string | null, status?: string | null, startedAt?: string | null } | null,
 * }} input
 * @returns {ProviderFirstSignalStatus}
 */
export function buildProviderFirstSignalStatus(input) {
  const copy = getProviderOnboardingCopy(input?.providerId)

  if (!input?.hasSelectedNode) {
    return {
      stage: "select-node",
      badge: "Select a node",
      title: "Pick a target node",
      detail: `Choose the Automation Map node that should receive ${copy.providerName} run telemetry.`,
      primaryAction: "Select node",
    }
  }

  if (input.hasRun) {
    const runLabel = input.latestRun?.externalId || "latest submitted run"
    const runStatus = input.latestRun?.status ? ` with status ${input.latestRun.status}` : ""
    const runTime = input.latestRun?.startedAt ? ` at ${input.latestRun.startedAt}` : ""
    return {
      stage: "run-received",
      badge: copy.signalReceivedLabel,
      title: "First workflow signal is live",
      detail: `${copy.providerName} reported ${runLabel}${runStatus}${runTime}.`,
      primaryAction: "Open Runs",
    }
  }

  if (!input.hasToken) {
    return {
      stage: "create-token",
      badge: "Token needed",
      title: `Create a ${copy.providerName} token`,
      detail: "Create a one-time ingestion token and copy it immediately. Meridian will not show the raw token again.",
      primaryAction: "Create token",
    }
  }

  return {
    stage: "send-first-run",
    badge: copy.awaitingSignalLabel,
    title: copy.runTitle,
    detail: copy.setupInstruction,
    primaryAction: "Send test run",
  }
}
