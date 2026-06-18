/**
 * Safe operational fallback for unavailable database-backed services.
 */

import { AlertTriangle, RefreshCw } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * Shows a recoverable service interruption without exposing infrastructure details.
 */
export function ServiceUnavailable({ incidentId }: { incidentId: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <CardTitle>ArgusGrid is temporarily unavailable</CardTitle>
          <CardDescription>
            A required service could not be reached. Your data has not been changed. Please retry shortly.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link className={cn(buttonVariants(), "w-full")} href="/">
            <RefreshCw data-icon="inline-start" />
            Retry
          </Link>
          <p className="text-xs text-muted-foreground">Incident ID: {incidentId}</p>
        </CardContent>
      </Card>
    </main>
  )
}
