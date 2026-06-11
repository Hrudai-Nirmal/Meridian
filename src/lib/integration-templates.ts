export type IntegrationTemplate = {
  id: "dify" | "n8n" | "github-actions" | "custom-rest-metric"
  name: string
  category: string
  difficulty: "Basic" | "Advanced"
  mode: "basic" | "advanced"
  setupKind: "metric" | "telemetry"
  description: string
  requiredFields: string[]
  basicSteps: string[]
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
    description: "Use this to report Dify workflow or agent executions into the selected ArgusGrid node.",
    requiredFields: ["Ingestion token", "Dify workflow id", "Dify execution status"],
    basicSteps: ["Create an ingestion token.", "Add an HTTP request step at the end of the Dify workflow.", "Map Dify run fields into the template.", "Refresh Runs."],
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
    basicSteps: ["Create an ingestion token.", "Add an HTTP Request node after your workflow.", "Paste the JSON body template.", "Refresh Runs."],
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
    basicSteps: ["Store the ingestion token as a GitHub secret.", "Add the reporting step to your workflow.", "Run the workflow.", "Refresh Runs."],
  },
  {
    id: "custom-rest-metric",
    name: "OpenAI / Custom REST Metric",
    category: "Metric Polling",
    difficulty: "Advanced",
    mode: "advanced",
    setupKind: "metric",
    description: "Use this for OpenAI usage endpoints or any JSON endpoint ArgusGrid should poll on a schedule.",
    requiredFields: ["Endpoint URL", "Auth method", "JSONPath", "Threshold"],
    basicSteps: ["Apply the metric preset.", "Replace the endpoint URL.", "Test the endpoint.", "Save API setup and alert rule."],
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
