CREATE INDEX "WorkflowRun_startedAt_idx" ON "WorkflowRun"("startedAt");
CREATE INDEX "MetricSample_sampledAt_idx" ON "MetricSample"("sampledAt");
CREATE INDEX "AlertEvent_nodeId_createdAt_idx" ON "AlertEvent"("nodeId", "createdAt");
CREATE INDEX "AlertEvent_createdAt_idx" ON "AlertEvent"("createdAt");
CREATE INDEX "AlertNotificationDelivery_alertEventId_attemptedAt_idx" ON "AlertNotificationDelivery"("alertEventId", "attemptedAt");
CREATE INDEX "AlertNotificationDelivery_attemptedAt_idx" ON "AlertNotificationDelivery"("attemptedAt");
