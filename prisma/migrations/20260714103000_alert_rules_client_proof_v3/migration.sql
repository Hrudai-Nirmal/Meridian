ALTER TABLE "ReportShare" ADD COLUMN "periodMode" TEXT NOT NULL DEFAULT 'window';
ALTER TABLE "ReportShare" ADD COLUMN "periodWindow" TEXT DEFAULT '30d';
ALTER TABLE "ReportShare" ADD COLUMN "periodStart" TIMESTAMP(3);
ALTER TABLE "ReportShare" ADD COLUMN "periodEnd" TIMESTAMP(3);
ALTER TABLE "ReportShare" ADD COLUMN "comparisonEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ReportShare" ADD COLUMN "presetId" TEXT;

CREATE TABLE "ReportPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT,
    "subtitle" TEXT,
    "preparedBy" TEXT,
    "executiveNote" TEXT,
    "brandImageMimeType" TEXT,
    "brandImageData" BYTEA,
    "periodMode" TEXT NOT NULL DEFAULT 'window',
    "periodWindow" TEXT DEFAULT '30d',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "comparisonEnabled" BOOLEAN NOT NULL DEFAULT true,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportPreset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportShare_presetId_idx" ON "ReportShare"("presetId");
CREATE INDEX "ReportPreset_projectId_idx" ON "ReportPreset"("projectId");
CREATE INDEX "ReportPreset_createdById_idx" ON "ReportPreset"("createdById");

ALTER TABLE "ReportShare" ADD CONSTRAINT "ReportShare_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "ReportPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReportPreset" ADD CONSTRAINT "ReportPreset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportPreset" ADD CONSTRAINT "ReportPreset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
