-- CreateTable
CREATE TABLE "PollExecution" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "sampledNodes" INTEGER NOT NULL DEFAULT 0,
    "createdSamples" INTEGER NOT NULL DEFAULT 0,
    "evaluatedAlerts" INTEGER NOT NULL DEFAULT 0,
    "rollupsQueued" INTEGER NOT NULL DEFAULT 0,
    "deletedSamples" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PollExecution_startedAt_idx" ON "PollExecution"("startedAt");

-- CreateIndex
CREATE INDEX "PollExecution_status_startedAt_idx" ON "PollExecution"("status", "startedAt");
