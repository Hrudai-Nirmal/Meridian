CREATE TABLE "ProjectSlackDestination" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "webhookUrlEncrypted" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minimumSeverity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "eventFilters" JSONB,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSlackDestination_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectSlackDestination_projectId_enabled_idx" ON "ProjectSlackDestination"("projectId", "enabled");
CREATE INDEX "ProjectSlackDestination_minimumSeverity_idx" ON "ProjectSlackDestination"("minimumSeverity");

ALTER TABLE "ProjectSlackDestination" ADD CONSTRAINT "ProjectSlackDestination_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
