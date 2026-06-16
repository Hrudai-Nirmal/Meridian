-- CreateTable
CREATE TABLE "ProjectWebhookDestination" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "eventFilters" JSONB,
    "signingSecretEncrypted" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectWebhookDestination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectWebhookDestination_projectId_enabled_idx" ON "ProjectWebhookDestination"("projectId", "enabled");

-- AddForeignKey
ALTER TABLE "ProjectWebhookDestination" ADD CONSTRAINT "ProjectWebhookDestination_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
