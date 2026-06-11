import { chromium } from "playwright"

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000"
const authState = process.env.SMOKE_AUTH_STATE
const runMutations = process.env.SMOKE_MUTATION === "1"

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function json(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const browser = await chromium.launch({ headless: true })

try {
  const publicPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await publicPage.goto(baseUrl, { waitUntil: "networkidle" })
  const publicText = await publicPage.textContent("body")
  assert(
    publicText?.includes("Sign in to ArgusGrid") ||
      publicText?.includes("Connect ArgusGrid") ||
      publicText?.includes("Set up your ArgusGrid workspace") ||
      publicText?.includes("ArgusGrid"),
    "Public app shell did not render an expected ArgusGrid state."
  )
  const overflow = await publicPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  assert(!overflow, "Public page has horizontal overflow at 1440px.")

  const healthResponse = await publicPage.request.get(`${baseUrl}/api/health`)
  const health = await json(healthResponse)
  assert(health && typeof health.ok === "boolean", "Health route did not return safe readiness JSON.")
  assert(!JSON.stringify(health).includes("npg_"), "Health route leaked a database secret-looking value.")
  assert(!JSON.stringify(health).includes("GITHUB_SECRET"), "Health route leaked secret field names.")

  const cronResponse = await publicPage.request.get(`${baseUrl}/api/cron/poll`, {
    headers: { Authorization: "Bearer definitely-wrong" },
  })
  assert(cronResponse.status() === 401, "Cron route did not reject a wrong bearer token.")

  const demoMetricResponse = await publicPage.request.get(`${baseUrl}/api/demo/metric`)
  const demoMetric = await json(demoMetricResponse)
  assert(demoMetricResponse.ok() && demoMetric?.value === 95, "Demo metric route did not return the expected deterministic sample.")

  const manualPollResponse = await publicPage.request.post(`${baseUrl}/api/projects/not-a-real-project/poll/run`)
  assert(manualPollResponse.status() === 401, "Manual poll route did not require authentication.")

  const ingestResponse = await publicPage.request.post(`${baseUrl}/api/ingest/runs`, {
    data: {
      nodeId: "not-a-real-node",
      status: "success",
      startedAt: "2026-06-12T09:30:00.000Z",
    },
  })
  assert(ingestResponse.status() === 401, "Workflow run ingestion did not reject missing token authentication.")

  await publicPage.close()

  if (authState) {
    const context = await browser.newContext({ storageState: authState, viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    await page.goto(baseUrl, { waitUntil: "networkidle" })
    await page.getByText("ArgusGrid").first().waitFor({ timeout: 15000 })
    await page.getByText("Deployment").click()
    await page.getByText("Deployment readiness").waitFor()
    await page.keyboard.press("Escape")
    await page.getByText("Team").click()
    await page.getByText("Team access").waitFor()
    await page.keyboard.press("Escape")

    if (runMutations) {
      const suffix = Date.now()
      await page.getByText("New").click()
      await page.getByRole("textbox").last().fill(`Smoke Project ${suffix}`)
      await page.getByText("Create").click()
      await page.waitForURL(/project=/, { timeout: 15000 })
      await page.getByText("Manage").click()
      await page.getByRole("textbox").last().fill(`Smoke Project ${suffix} Renamed`)
      await page.getByText("Rename").click()
      await page.waitForLoadState("networkidle")
      await page.getByText("Team").click()
      await page.getByPlaceholder("teammate@example.com").fill(`smoke+${suffix}@argusgrid.test`)
      await page.getByText("Save invitation").click()
      await page.getByText("Invitation saved.").waitFor()
    }

    await context.close()
  }

  console.log(`Smoke checks passed for ${baseUrl}`)
} finally {
  await browser.close()
}
