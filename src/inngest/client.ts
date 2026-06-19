/**
 * Meridian's server-only Inngest client. Events contain database identifiers only.
 */
import "server-only"

import { Inngest } from "inngest"

export const inngest = new Inngest({ id: "meridian", name: "Meridian" })
