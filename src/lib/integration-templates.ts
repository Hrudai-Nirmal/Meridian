export type IntegrationTemplate = {
  id: "dify" | "n8n" | "github-actions" | "javascript-sdk" | "custom-rest-metric"
  name: string
  category: string
  difficulty: "Basic" | "Advanced"
  mode: "basic" | "advanced"
  setupKind: "metric" | "telemetry"
  description: string
  requiredFields: string[]
  basicSteps: string[]
  tokenName: string
  testRun: {
    name: string
    toolName: string
    tokens?: number
    costUsd?: number
  }
  preset?: {
    apiUrl: string
    authType: "NONE" | "API_KEY_HEADER" | "BEARER_TOKEN" | "BASIC" | "CUSTOM_HEADERS"
    cadenceMin: string
    mappingLabel: string
    jsonPath: string
    transform: string
    unit: string
    threshold: string
    visualization: "NUMBER" | "LINE" | "BAR" | "TABLE" | "STATUS" | "HEATMAP"
    ruleName: string
    ruleExpression: string
    ruleSeverity: "INFO" | "WARNING" | "CRITICAL"
  }
}

export const integrationTemplates: IntegrationTemplate[] = [
  {
    id: "dify",
    name: "Dify Workflow",
    category: "AI App Runs",
    difficulty: "Basic",
    mode: "basic",
    setupKind: "telemetry",
    description: "Use this to report Dify workflow or agent executions into the selected Meridian node.",
    requiredFields: ["Ingestion token", "Dify workflow id", "Dify execution status"],
    basicSteps: ["Create an ingestion token.", "Send the built-in test run.", "Add an HTTP request step at the end of the Dify workflow.", "Map Dify run fields into the template.", "Refresh Runs."],
    tokenName: "Dify workflow telemetry",
    testRun: {
      name: "Dify workflow test",
      toolName: "dify",
      tokens: 840,
      costUsd: 0.018,
    },
  },
  {
    id: "n8n",
    name: "n8n Workflow",
    category: "Automation Runs",
    difficulty: "Basic",
    mode: "basic",
    setupKind: "telemetry",
    description: "Use this to report n8n workflow executions with step names, status, and duration.",
    requiredFields: ["Ingestion token", "Workflow execution id", "Node status"],
    basicSteps: ["Create an ingestion token.", "Send the built-in test run.", "Add an HTTP Request node after your workflow.", "Paste the JSON body template.", "Refresh Runs."],
    tokenName: "n8n workflow telemetry",
    testRun: {
      name: "n8n workflow test",
      toolName: "n8n",
      tokens: 240,
      costUsd: 0.004,
    },
  },
  {
    id: "github-actions",
    name: "GitHub Actions",
    category: "CI/CD Runs",
    difficulty: "Advanced",
    mode: "advanced",
    setupKind: "telemetry",
    description: "Use this to report CI workflow status, timing, and job steps from a GitHub Actions workflow.",
    requiredFields: ["Ingestion token secret", "Selected node id", "GitHub run metadata"],
    basicSteps: ["Create an ingestion token.", "Send the built-in test run.", "Store the ingestion token as a GitHub secret.", "Add the reporting step to your workflow.", "Run the workflow.", "Refresh Runs."],
    tokenName: "GitHub Actions telemetry",
    testRun: {
      name: "GitHub Actions job test",
      toolName: "github-actions",
      tokens: 0,
      costUsd: 0,
    },
  },
  {
    id: "javascript-sdk",
    name: "JavaScript SDK",
    category: "SDK Telemetry",
    difficulty: "Basic",
    mode: "basic",
    setupKind: "telemetry",
    description: "Use the published npm package to report Node.js apps, jobs, scripts, and serverless handlers.",
    requiredFields: ["Ingestion token", "Selected node id", "Node.js runtime"],
    basicSteps: ["Create an ingestion token.", "Install @meridian-workflows/sdk.", "Set token and node id environment variables.", "Run the SDK test command.", "Refresh Runs."],
    tokenName: "JavaScript SDK telemetry",
    testRun: {
      name: "JavaScript SDK test",
      toolName: "javascript-sdk",
      tokens: 420,
      costUsd: 0.012,
    },
  },
  {
    id: "custom-rest-metric",
    name: "OpenAI / Custom REST Metric",
    category: "Metric Polling",
    difficulty: "Advanced",
    mode: "advanced",
    setupKind: "metric",
    description: "Use this for OpenAI usage endpoints or any JSON endpoint Meridian should poll on a schedule.",
    requiredFields: ["Endpoint URL", "Auth method", "JSONPath", "Threshold"],
    basicSteps: ["Apply the metric preset.", "Replace the endpoint URL.", "Test the endpoint.", "Save API setup and alert rule."],
    tokenName: "Custom REST metric reference",
    testRun: {
      name: "Custom REST setup note",
      toolName: "custom-rest",
      tokens: 0,
      costUsd: 0,
    },
    preset: {
      apiUrl: "https://api.example.com/automation/health",
      authType: "BEARER_TOKEN",
      cadenceMin: "15",
      mappingLabel: "Automation health",
      jsonPath: "$.health.score",
      transform: "none",
      unit: "score",
      threshold: "< 70",
      visualization: "NUMBER",
      ruleName: "Automation health below target",
      ruleExpression: "< 70",
      ruleSeverity: "WARNING",
    },
  },
]
