-- CreateTable
CREATE TABLE "IngestionToken" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngestionToken_tokenHash_key" ON "IngestionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "IngestionToken_projectId_revokedAt_idx" ON "IngestionToken"("projectId", "revokedAt");

-- CreateIndex
CREATE INDEX "IngestionToken_createdById_idx" ON "IngestionToken"("createdById");

-- CreateIndex
CREATE INDEX "IngestionToken_prefix_idx" ON "IngestionToken"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRun_nodeId_externalId_key" ON "WorkflowRun"("nodeId", "externalId");

-- CreateIndex
CREATE INDEX "WorkflowRun_nodeId_startedAt_idx" ON "WorkflowRun"("nodeId", "startedAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_nodeId_externalId_idx" ON "WorkflowRun"("nodeId", "externalId");

-- CreateIndex
CREATE INDEX "WorkflowStep_runId_idx" ON "WorkflowStep"("runId");

-- AddForeignKey
ALTER TABLE "IngestionToken" ADD CONSTRAINT "IngestionToken_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionToken" ADD CONSTRAINT "IngestionToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
