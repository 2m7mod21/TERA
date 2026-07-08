/*
  Warnings:

  - Added the required column `contentId` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contentType` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Report` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "ReportAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportAction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReportAction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserViolation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reportId" TEXT,
    "violationType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "strikeNumber" INTEGER NOT NULL DEFAULT 1,
    "actionTaken" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "issuedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserViolation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserViolation_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "violationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Appeal_violationId_fkey" FOREIGN KEY ("violationId") REFERENCES "UserViolation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Appeal_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "postId" TEXT,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assignedModeratorId" TEXT,
    "resolvedAt" DATETIME,
    "aiScore" REAL,
    "aiCategory" TEXT,
    "aiResult" TEXT,
    "aiConfidence" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Report_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Report_assignedModeratorId_fkey" FOREIGN KEY ("assignedModeratorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Report" ("createdAt", "details", "id", "postId", "priority", "reason", "reporterId", "status") SELECT "createdAt", "details", "id", "postId", "priority", "reason", "reporterId", "status" FROM "Report";
DROP TABLE "Report";
ALTER TABLE "new_Report" RENAME TO "Report";
CREATE INDEX "Report_status_priority_createdAt_idx" ON "Report"("status", "priority", "createdAt");
CREATE INDEX "Report_contentType_contentId_idx" ON "Report"("contentType", "contentId");
CREATE INDEX "Report_reportedUserId_createdAt_idx" ON "Report"("reportedUserId", "createdAt");
CREATE INDEX "Report_reporterId_createdAt_idx" ON "Report"("reporterId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ReportAction_reportId_createdAt_idx" ON "ReportAction"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportAction_adminId_createdAt_idx" ON "ReportAction"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "UserViolation_userId_createdAt_idx" ON "UserViolation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserViolation_isActive_userId_idx" ON "UserViolation"("isActive", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Appeal_violationId_key" ON "Appeal"("violationId");

-- CreateIndex
CREATE INDEX "Appeal_status_createdAt_idx" ON "Appeal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Appeal_userId_status_idx" ON "Appeal"("userId", "status");
