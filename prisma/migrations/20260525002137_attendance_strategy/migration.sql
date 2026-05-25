-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClassSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "expectedStudentCount" INTEGER,
    "minTeamSize" INTEGER NOT NULL DEFAULT 4,
    "maxTeamSize" INTEGER NOT NULL DEFAULT 5,
    "attendanceModeStrategy" TEXT NOT NULL DEFAULT 'PREFER_SAME_ATTENDANCE',
    "targetDrawPercent" REAL NOT NULL DEFAULT 0.70,
    "revealValuationHistogram" BOOLEAN NOT NULL DEFAULT false,
    "revealTeamValuations" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ClassSession" ("code", "createdAt", "expectedStudentCount", "id", "maxTeamSize", "minTeamSize", "name", "revealTeamValuations", "revealValuationHistogram", "status", "targetDrawPercent", "updatedAt") SELECT "code", "createdAt", "expectedStudentCount", "id", "maxTeamSize", "minTeamSize", "name", "revealTeamValuations", "revealValuationHistogram", "status", "targetDrawPercent", "updatedAt" FROM "ClassSession";
DROP TABLE "ClassSession";
ALTER TABLE "new_ClassSession" RENAME TO "ClassSession";
CREATE UNIQUE INDEX "ClassSession_code_key" ON "ClassSession"("code");
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classSessionId" TEXT NOT NULL,
    "teamNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "plannedSize" INTEGER,
    "attendanceMix" TEXT NOT NULL DEFAULT 'MIXED',
    "inPersonCount" INTEGER,
    "onlineCount" INTEGER,
    "captainEmail" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Team_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("active", "captainEmail", "classSessionId", "createdAt", "id", "name", "plannedSize", "teamNumber", "updatedAt") SELECT "active", "captainEmail", "classSessionId", "createdAt", "id", "name", "plannedSize", "teamNumber", "updatedAt" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE INDEX "Team_classSessionId_active_idx" ON "Team"("classSessionId", "active");
CREATE UNIQUE INDEX "Team_classSessionId_teamNumber_key" ON "Team"("classSessionId", "teamNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
