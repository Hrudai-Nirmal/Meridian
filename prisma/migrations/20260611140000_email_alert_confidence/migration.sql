-- AlterTable
ALTER TABLE "AlertRule" ADD COLUMN "mappingId" TEXT,
ADD COLUMN "metadata" JSONB,
ADD COLUMN "nodeId" TEXT;

-- CreateTable
CREATE TABLE "AlertNotificationDelivery" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT,
    "failureReason" TEXT,
    "alertEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "AlertNotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertRule_projectId_enabled_idx" ON "AlertRule"("projectId", "enabled");

-- CreateIndex
CREATE INDEX "AlertRule_nodeId_idx" ON "AlertRule"("nodeId");

-- CreateIndex
CREATE INDEX "AlertRule_mappingId_idx" ON "AlertRule"("mappingId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_channel_key" ON "NotificationPreference"("userId", "channel");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "AlertNotificationDelivery_alertEventId_idx" ON "AlertNotificationDelivery"("alertEventId");

-- CreateIndex
CREATE INDEX "AlertNotificationDelivery_status_attemptedAt_idx" ON "AlertNotificationDelivery"("status", "attemptedAt");

-- CreateIndex
CREATE INDEX "AlertNotificationDelivery_recipient_attemptedAt_idx" ON "AlertNotificationDelivery"("recipient", "attemptedAt");

-- AddForeignKey
ALTER TABLE "AlertNotificationDelivery" ADD CONSTRAINT "AlertNotificationDelivery_alertEventId_fkey" FOREIGN KEY ("alertEventId") REFERENCES "AlertEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
