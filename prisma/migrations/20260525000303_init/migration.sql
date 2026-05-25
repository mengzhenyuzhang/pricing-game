-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classSessionId" TEXT NOT NULL,
    "teamNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "plannedSize" INTEGER,
    "captainEmail" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Team_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Valuation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classSessionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "studentAlias" TEXT,
    "segment" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Valuation_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classSessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "capacity" INTEGER NOT NULL,
    "drawCount" INTEGER,
    "drawPercent" REAL NOT NULL DEFAULT 0.70,
    "dynamicPeriods" INTEGER NOT NULL DEFAULT 10,
    "segmentCutoff" INTEGER,
    "segmentCutoffPercent" DOUBLE PRECISION,
    "revealPrices" BOOLEAN NOT NULL DEFAULT false,
    "revealEventDetails" BOOLEAN NOT NULL DEFAULT false,
    "revealValuationHistogram" BOOLEAN NOT NULL DEFAULT false,
    "currentPeriod" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GameRun_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "expectedStudentCount" INTEGER,
    "minTeamSize" INTEGER NOT NULL DEFAULT 4,
    "maxTeamSize" INTEGER NOT NULL DEFAULT 5,
    "targetDrawPercent" REAL NOT NULL DEFAULT 0.70,
    "revealValuationHistogram" BOOLEAN NOT NULL DEFAULT false,
    "revealTeamValuations" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classSessionId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "attendanceMode" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "valuationAmount" INTEGER NOT NULL,
    "teamId" TEXT,
    "sessionTokenHash" TEXT,
    "checkedInAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Participant_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Participant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoundPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameRunId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "deadline" DATETIME,
    "instructions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoundPeriod_gameRunId_fkey" FOREIGN KEY ("gameRunId") REFERENCES "GameRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerDraw" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameRunId" TEXT NOT NULL,
    "participantId" TEXT,
    "valuationAmountSnapshot" INTEGER NOT NULL,
    "customerLabel" TEXT NOT NULL,
    "segment" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "drawOrder" INTEGER NOT NULL,
    "periodNumber" INTEGER,
    "useInRun" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CustomerDraw_gameRunId_fkey" FOREIGN KEY ("gameRunId") REFERENCES "GameRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerDraw_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classSessionId" TEXT NOT NULL,
    "gameRunId" TEXT NOT NULL,
    "periodId" TEXT,
    "teamId" TEXT NOT NULL,
    "submitterParticipantId" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price" INTEGER,
    "lowPrice" INTEGER,
    "highPrice" INTEGER,
    "bookingLimit" INTEGER,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "validationMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Submission_gameRunId_fkey" FOREIGN KEY ("gameRunId") REFERENCES "GameRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "RoundPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_submitterParticipantId_fkey" FOREIGN KEY ("submitterParticipantId") REFERENCES "Participant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActiveDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameRunId" TEXT NOT NULL,
    "periodId" TEXT,
    "teamId" TEXT NOT NULL,
    "submitterParticipantId" TEXT,
    "priceUsed" INTEGER,
    "lowPriceUsed" INTEGER,
    "highPriceUsed" INTEGER,
    "bookingLimitUsed" INTEGER,
    "submittedAt" DATETIME NOT NULL,
    CONSTRAINT "ActiveDecision_gameRunId_fkey" FOREIGN KEY ("gameRunId") REFERENCES "GameRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActiveDecision_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "RoundPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActiveDecision_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActiveDecision_submitterParticipantId_fkey" FOREIGN KEY ("submitterParticipantId") REFERENCES "Participant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameRunId" TEXT NOT NULL,
    "periodId" TEXT,
    "teamId" TEXT NOT NULL,
    "sales" INTEGER NOT NULL,
    "lowSales" INTEGER NOT NULL DEFAULT 0,
    "highSales" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL,
    "capacityUsed" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "eventsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamResult_gameRunId_fkey" FOREIGN KEY ("gameRunId") REFERENCES "GameRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamResult_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "RoundPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamResult_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Team_classSessionId_active_idx" ON "Team"("classSessionId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Team_classSessionId_teamNumber_key" ON "Team"("classSessionId", "teamNumber");

-- CreateIndex
CREATE INDEX "Valuation_classSessionId_idx" ON "Valuation"("classSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Valuation_classSessionId_customerId_key" ON "Valuation"("classSessionId", "customerId");

-- CreateIndex
CREATE INDEX "GameRun_classSessionId_status_idx" ON "GameRun"("classSessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSession_code_key" ON "ClassSession"("code");

-- CreateIndex
CREATE INDEX "Participant_classSessionId_teamId_idx" ON "Participant"("classSessionId", "teamId");

-- CreateIndex
CREATE INDEX "Participant_sessionTokenHash_idx" ON "Participant"("sessionTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RoundPeriod_gameRunId_periodNumber_key" ON "RoundPeriod"("gameRunId", "periodNumber");

-- CreateIndex
CREATE INDEX "CustomerDraw_gameRunId_periodNumber_idx" ON "CustomerDraw"("gameRunId", "periodNumber");

-- CreateIndex
CREATE INDEX "Submission_gameRunId_periodId_teamId_submittedAt_idx" ON "Submission"("gameRunId", "periodId", "teamId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveDecision_gameRunId_periodId_teamId_key" ON "ActiveDecision"("gameRunId", "periodId", "teamId");

-- CreateIndex
CREATE INDEX "TeamResult_gameRunId_rank_idx" ON "TeamResult"("gameRunId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "TeamResult_gameRunId_periodId_teamId_key" ON "TeamResult"("gameRunId", "periodId", "teamId");
