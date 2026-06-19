/**
 * GitHub sign-in screen with a native OAuth form redirect.
 */

"use client"

import { getCsrfToken } from "next-auth/react"
import { GitBranch, Network } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Renders a resilient GitHub OAuth entry point.
 */
export function SignInScreen() {
  const [csrfToken, setCsrfToken] = useState("")
  const [authError, setAuthError] = useState("")
  const [isCheckingReadiness, setIsCheckingReadiness] = useState(true)
  const [isServiceReady, setIsServiceReady] = useState(false)

  const loadSignInReadiness = useCallback(async (signal?: AbortSignal) => {
    try {
      const [token, healthResponse] = await Promise.all([
        getCsrfToken(),
        fetch("/api/health", { cache: "no-store", signal }),
      ])
      const health = await healthResponse.json().catch(() => null)
      if (!token) {
        throw new Error("Auth.js did not return a CSRF token.")
      }
      setCsrfToken(token)

      if (!health?.checks?.database) {
        const incidentId = health?.issues?.find((issue: { component?: string }) => issue.component === "database")?.incidentId
        setAuthError(`Meridian cannot create a secure session because its database is unavailable.${incidentId ? ` Incident ID: ${incidentId}` : ""}`)
        return
      }
      if (!health?.checks?.auth) {
        setAuthError("GitHub authentication is temporarily unavailable.")
        return
      }

      setAuthError("")
      setIsServiceReady(true)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      setAuthError("GitHub sign-in readiness could not be verified. Please retry.")
    } finally {
      if (!signal?.aborted) setIsCheckingReadiness(false)
    }
  }, [])

  function handleReadinessRetry() {
    setIsCheckingReadiness(true)
    setIsServiceReady(false)
    void loadSignInReadiness()
  }

  useEffect(() => {
    const controller = new AbortController()
    const readinessTimer = window.setTimeout(() => {
      void loadSignInReadiness(controller.signal)
    }, 0)

    return () => {
      window.clearTimeout(readinessTimer)
      controller.abort()
    }
  }, [loadSignInReadiness])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Network className="size-6" />
          </div>
          <CardTitle>Sign in to Meridian</CardTitle>
          <CardDescription>Enter the AI automation control room for live ops, cost, quality, and client proof.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form action="/api/auth/signin/github" method="post">
            <input name="csrfToken" type="hidden" value={csrfToken} />
            <input name="callbackUrl" type="hidden" value="/" />
            <Button className="w-full" type="submit" disabled={!csrfToken || !isServiceReady}>
              <GitBranch data-icon="inline-start" />
              {isCheckingReadiness ? "Checking service readiness..." : "Continue with GitHub"}
            </Button>
          </form>
          {authError ? <p className="text-sm text-destructive" role="alert">{authError}</p> : null}
          {authError ? (
            <Button type="button" variant="outline" onClick={handleReadinessRetry} disabled={isCheckingReadiness}>
              Retry readiness
            </Button>
          ) : null}
          <p className="text-xs leading-5 text-muted-foreground">
            First sign-in creates your organization and starts an agency-ready automation map you can monitor and report on.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
