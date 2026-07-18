ALTER TABLE "AlertEvent"
ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "occurrenceCount" INTEGER NOT NULL DEFAULT 1;

UPDATE "AlertEvent"
SET "lastSeenAt" = "createdAt";

CREATE INDEX "AlertEvent_nodeId_ruleId_resolvedAt_idx" ON "AlertEvent"("nodeId", "ruleId", "resolvedAt");
CREATE INDEX "AlertEvent_lastSeenAt_idx" ON "AlertEvent"("lastSeenAt");
