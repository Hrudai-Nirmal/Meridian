import { chromium } from "playwright"

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000"
const authState = process.env.SMOKE_AUTH_STATE
const runMutations = process.env.SMOKE_MUTATION === "1"
const requireReady = process.env.SMOKE_REQUIRE_READY === "1"

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

function assertAuthenticationGuard(response, message) {
  const expectedStatuses = requireReady ? [401] : [401, 503]
  assert(expectedStatuses.includes(response.status()), message)
}

const browser = await chromium.launch({ headless: true })

try {
  const publicPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await publicPage.goto(baseUrl, { waitUntil: "networkidle" })
  const publicText = await publicPage.textContent("body")
  assert(
    publicText?.includes("Sign in to Meridian") ||
      publicText?.includes("Connect Meridian") ||
      publicText?.includes("Set up your Meridian workspace") ||
      publicText?.includes("Meridian"),
    "Public app shell did not render an expected Meridian state."
  )
  const overflow = await publicPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  assert(!overflow, "Public page has horizontal overflow at 1440px.")

  const healthResponse = await publicPage.request.get(`${baseUrl}/api/health`)
  const health = await json(healthResponse)
  assert(health && typeof health.ok === "boolean", "Health route did not return safe readiness JSON.")
  assert(typeof health?.build?.version === "string" && health.build.version.length > 0, "Health route did not return app version metadata.")
  assert(typeof health?.build?.commitSha === "string" && health.build.commitSha.length > 0, "Health route did not return commit metadata.")
  assert(typeof health?.build?.environment === "string" && health.build.environment.length > 0, "Health route did not return environment metadata.")
  assert(Array.isArray(health?.issues), "Health route did not return safe issue metadata.")
  if (requireReady) {
    assert(healthResponse.ok(), `Production readiness failed: ${health?.issues?.map((issue) => issue.code).join(", ") || "unknown issue"}.`)
    assert(health?.checks?.database === true, "Production database readiness is not healthy.")
    assert(health?.checks?.auth === true, "Production authentication readiness is not healthy.")
  }
  assert(!JSON.stringify(health).includes("npg_"), "Health route leaked a database secret-looking value.")
  assert(!JSON.stringify(health).includes("GITHUB_SECRET"), "Health route leaked secret field names.")
  assert(!JSON.stringify(health).includes("ENCRYPTION_KEY"), "Health route leaked secret field names.")
  assert(!JSON.stringify(health).includes("CRON_SECRET"), "Health route leaked secret field names.")
  assert(!JSON.stringify(health).includes("RESEND_API_KEY"), "Health route leaked secret field names.")
  assert(!JSON.stringify(health).includes("INNGEST_EVENT_KEY"), "Health route leaked Inngest event-key field names.")
  assert(!JSON.stringify(health).includes("INNGEST_SIGNING_KEY"), "Health route leaked Inngest signing-key field names.")
  assert(!JSON.stringify(health).includes("hooks.slack.com/services/"), "Health route leaked a Slack webhook URL.")

  const cronResponse = await publicPage.request.get(`${baseUrl}/api/cron/poll`, {
    headers: { Authorization: "Bearer definitely-wrong" },
  })
  assert(cronResponse.status() === 401, "Cron route did not reject a wrong bearer token.")

  const demoMetricResponse = await publicPage.request.get(`${baseUrl}/api/demo/metric`)
  const demoMetric = await json(demoMetricResponse)
  assert(demoMetricResponse.ok() && demoMetric?.value === 95, "Demo metric route did not return the expected deterministic sample.")

  const manualPollResponse = await publicPage.request.post(`${baseUrl}/api/projects/not-a-real-project/poll/run`)
  assertAuthenticationGuard(manualPollResponse, "Manual poll route did not enforce authentication or report service unavailability.")

  const liveEventsResponse = await publicPage.request.get(`${baseUrl}/api/projects/not-a-real-project/events`)
  assertAuthenticationGuard(liveEventsResponse, "Project live events route did not enforce authentication or report service unavailability.")

  const ingestResponse = await publicPage.request.post(`${baseUrl}/api/ingest/runs`, {
    data: {
      nodeId: "not-a-real-node",
      status: "success",
      startedAt: "2026-06-12T09:30:00.000Z",
    },
  })
  assert(ingestResponse.status() === 401, "Workflow run ingestion did not reject missing token authentication.")

  const notificationJobsResponse = await publicPage.request.get(`${baseUrl}/api/projects/not-a-real-project/notification-jobs`)
  assertAuthenticationGuard(notificationJobsResponse, "Notification jobs route did not enforce authentication.")

  const inngestDiscoveryResponse = await publicPage.request.get(`${baseUrl}/api/inngest`)
  assert([200, 503].includes(inngestDiscoveryResponse.status()), "Inngest discovery route did not report a valid configured or setup-required state.")

  const inngestResponse = await publicPage.request.post(`${baseUrl}/api/inngest`, {
    data: { name: "unauthorized-smoke" },
  })
  assert([401, 403, 503].includes(inngestResponse.status()), "Inngest execution route accepted an unsigned request.")

  const githubSignInButton = publicPage.getByRole("button", { name: "Continue with GitHub" })
  const githubSignInButtonCount = await githubSignInButton.count()
  if (requireReady) {
    assert(githubSignInButtonCount === 1, "Production GitHub sign-in button was not available.")
    assert(await githubSignInButton.isEnabled(), "Production GitHub sign-in is disabled by a failed readiness check.")
  }
  if (githubSignInButtonCount === 1 && await githubSignInButton.isEnabled()) {
    await githubSignInButton.click()
    await publicPage.waitForURL(/^https:\/\/github\.com\//, { timeout: 15000 })
  }

  await publicPage.close()

  if (authState) {
    const context = await browser.newContext({ storageState: authState, viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    await page.goto(baseUrl, { waitUntil: "networkidle" })
    await page.getByText("Meridian").first().waitFor({ timeout: 15000 })
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
      await page.getByPlaceholder("teammate@example.com").fill(`smoke+${suffix}@meridian.test`)
      await page.getByText("Save invitation").click()
      await page.getByText("Invitation saved.").waitFor()
    }

    await context.close()
  }

  process.stdout.write(`Smoke checks passed for ${baseUrl}\n`)
} finally {
  await browser.close()
}
