-- AlterTable
ALTER TABLE "UserViolation" ADD COLUMN "contentId" TEXT;
ALTER TABLE "UserViolation" ADD COLUMN "contentType" TEXT;
ALTER TABLE "UserViolation" ADD COLUMN "matchedWords" TEXT;

-- CreateTable
CREATE TABLE "BlockedWord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "word" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mentionedId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "storyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mention_mentionedId_fkey" FOREIGN KEY ("mentionedId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Mention_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Mention_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Mention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Mention_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImageTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImageTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InteractionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InteractionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedImpression" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "scoreBreakdown" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedImpression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedImpression_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffinityScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 0.0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffinityScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TopicAffinity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 0.0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TopicAffinity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedSuppressionEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "strength" REAL NOT NULL DEFAULT 1.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeedSuppressionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExposureFatigue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "shownCount" INTEGER NOT NULL DEFAULT 0,
    "engagedCount" INTEGER NOT NULL DEFAULT 0,
    "lastShownAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExposureFatigue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostQualityCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "qualityScore" REAL NOT NULL DEFAULT 1.0,
    "spamFlags" TEXT NOT NULL DEFAULT '{}',
    "lastRecalculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PostQualityCache_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreatorTrust" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "trustScore" REAL NOT NULL DEFAULT 1.0,
    "accountAgeDays" INTEGER NOT NULL DEFAULT 0,
    "verificationStatus" BOOLEAN NOT NULL DEFAULT false,
    "violationCount" INTEGER NOT NULL DEFAULT 0,
    "lastRecalculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreatorTrust_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedWeightConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileName" TEXT NOT NULL,
    "componentKey" TEXT NOT NULL,
    "weightValue" REAL NOT NULL,
    "updatedByAdminId" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FeedWeightAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "profileName" TEXT NOT NULL,
    "componentKey" TEXT NOT NULL,
    "oldValue" REAL NOT NULL,
    "newValue" REAL NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "coverUrl" TEXT,
    "bio" TEXT,
    "websiteUrl" TEXT,
    "location" TEXT,
    "relationshipStatus" TEXT,
    "privacyLevel" TEXT NOT NULL DEFAULT 'PUBLIC',
    "mentionPrivacy" TEXT NOT NULL DEFAULT 'EVERYONE',
    "education" TEXT NOT NULL DEFAULT '[]',
    "work" TEXT NOT NULL DEFAULT '[]',
    "skills" TEXT NOT NULL DEFAULT '[]',
    "languages" TEXT NOT NULL DEFAULT '[]',
    "interests" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Profile" ("avatarUrl", "bio", "coverUrl", "displayName", "education", "id", "interests", "languages", "location", "privacyLevel", "relationshipStatus", "skills", "updatedAt", "userId", "username", "websiteUrl", "work") SELECT "avatarUrl", "bio", "coverUrl", "displayName", "education", "id", "interests", "languages", "location", "privacyLevel", "relationshipStatus", "skills", "updatedAt", "userId", "username", "websiteUrl", "work" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
CREATE UNIQUE INDEX "Profile_username_key" ON "Profile"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BlockedWord_word_key" ON "BlockedWord"("word");

-- CreateIndex
CREATE INDEX "BlockedWord_word_idx" ON "BlockedWord"("word");

-- CreateIndex
CREATE INDEX "Mention_mentionedId_idx" ON "Mention"("mentionedId");

-- CreateIndex
CREATE INDEX "Mention_authorId_idx" ON "Mention"("authorId");

-- CreateIndex
CREATE INDEX "Mention_postId_idx" ON "Mention"("postId");

-- CreateIndex
CREATE INDEX "Mention_commentId_idx" ON "Mention"("commentId");

-- CreateIndex
CREATE INDEX "Mention_storyId_idx" ON "Mention"("storyId");

-- CreateIndex
CREATE INDEX "ImageTag_postId_idx" ON "ImageTag"("postId");

-- CreateIndex
CREATE INDEX "ImageTag_userId_idx" ON "ImageTag"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageTag_postId_userId_key" ON "ImageTag"("postId", "userId");

-- CreateIndex
CREATE INDEX "InteractionEvent_userId_type_createdAt_idx" ON "InteractionEvent"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "InteractionEvent_targetType_targetId_idx" ON "InteractionEvent"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "FeedImpression_userId_createdAt_idx" ON "FeedImpression"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedImpression_postId_idx" ON "FeedImpression"("postId");

-- CreateIndex
CREATE INDEX "AffinityScore_userId_score_idx" ON "AffinityScore"("userId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "AffinityScore_userId_targetType_targetId_key" ON "AffinityScore"("userId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "TopicAffinity_userId_idx" ON "TopicAffinity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicAffinity_userId_topic_key" ON "TopicAffinity"("userId", "topic");

-- CreateIndex
CREATE INDEX "FeedSuppressionEntry_userId_targetType_targetId_idx" ON "FeedSuppressionEntry"("userId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedSuppressionEntry_userId_targetType_targetId_key" ON "FeedSuppressionEntry"("userId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "ExposureFatigue_userId_targetType_targetId_idx" ON "ExposureFatigue"("userId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "ExposureFatigue_userId_targetType_targetId_key" ON "ExposureFatigue"("userId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "PostQualityCache_postId_key" ON "PostQualityCache"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorTrust_userId_key" ON "CreatorTrust"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedWeightConfig_profileName_componentKey_key" ON "FeedWeightConfig"("profileName", "componentKey");

-- CreateIndex
CREATE INDEX "FeedWeightAuditLog_profileName_componentKey_idx" ON "FeedWeightAuditLog"("profileName", "componentKey");
