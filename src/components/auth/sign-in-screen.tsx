/**
 * GitHub sign-in screen with a native OAuth form redirect.
 */

"use client"

import { getCsrfToken } from "next-auth/react"
import { GitBranch, Network } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Renders a resilient GitHub OAuth entry point.
 */
export function SignInScreen() {
  const [csrfToken, setCsrfToken] = useState("")
  const [authError, setAuthError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function loadCsrfToken() {
      try {
        const token = await getCsrfToken()
        if (!token) {
          throw new Error("Auth.js did not return a CSRF token.")
        }
        if (isMounted) {
          setCsrfToken(token)
          setAuthError("")
        }
      } catch {
        if (isMounted) {
          setAuthError("GitHub sign-in is temporarily unavailable. Refresh and try again.")
        }
      }
    }

    void loadCsrfToken()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Network className="size-6" />
          </div>
          <CardTitle>Sign in to ArgusGrid</CardTitle>
          <CardDescription>Enter the AI automation control room for live ops, cost, quality, and client proof.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form action="/api/auth/signin/github" method="post">
            <input name="csrfToken" type="hidden" value={csrfToken} />
            <input name="callbackUrl" type="hidden" value="/" />
            <Button className="w-full" type="submit" disabled={!csrfToken}>
              <GitBranch data-icon="inline-start" />
              {csrfToken ? "Continue with GitHub" : "Preparing GitHub sign-in..."}
            </Button>
          </form>
          {authError ? <p className="text-sm text-destructive" role="alert">{authError}</p> : null}
          <p className="text-xs leading-5 text-muted-foreground">
            First sign-in creates your organization and starts an agency-ready automation map you can monitor and report on.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
