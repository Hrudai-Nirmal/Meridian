-- CreateEnum
CREATE TYPE "NotificationJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'RETRYING', 'SENT', 'FAILED', 'SKIPPED', 'CANCELLED');

-- AlterTable
ALTER TABLE "AlertNotificationDelivery" ADD COLUMN "notificationJobId" TEXT;

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "NotificationJobStatus" NOT NULL DEFAULT 'QUEUED',
    "recipient" TEXT,
    "destinationId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "projectId" TEXT NOT NULL,
    "alertEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationJob_idempotencyKey_key" ON "NotificationJob"("idempotencyKey");
CREATE INDEX "NotificationJob_projectId_createdAt_idx" ON "NotificationJob"("projectId", "createdAt");
CREATE INDEX "NotificationJob_projectId_status_createdAt_idx" ON "NotificationJob"("projectId", "status", "createdAt");
CREATE INDEX "NotificationJob_status_updatedAt_idx" ON "NotificationJob"("status", "updatedAt");
CREATE INDEX "NotificationJob_alertEventId_idx" ON "NotificationJob"("alertEventId");
CREATE UNIQUE INDEX "AlertNotificationDelivery_notificationJobId_key" ON "AlertNotificationDelivery"("notificationJobId");

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_alertEventId_fkey" FOREIGN KEY ("alertEventId") REFERENCES "AlertEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AlertNotificationDelivery" ADD CONSTRAINT "AlertNotificationDelivery_notificationJobId_fkey" FOREIGN KEY ("notificationJobId") REFERENCES "NotificationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
