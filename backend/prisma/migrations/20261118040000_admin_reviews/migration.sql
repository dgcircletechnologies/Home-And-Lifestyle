ALTER TYPE "ModerationStatus" ADD VALUE IF NOT EXISTS 'SPAM';

ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT, ADD COLUMN "avatarPublicId" TEXT;
ALTER TABLE "Review" ADD COLUMN "moderationReason" TEXT, ADD COLUMN "trashedAt" TIMESTAMP(3), ADD COLUMN "storeReply" TEXT, ADD COLUMN "repliedAt" TIMESTAMP(3), ADD COLUMN "repliedById" TEXT;

CREATE TABLE "ReviewModerationHistory" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "previousStatus" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewModerationHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Review_moderationStatus_trashedAt_createdAt_id_idx" ON "Review"("moderationStatus", "trashedAt", "createdAt", "id");
CREATE INDEX "ReviewModerationHistory_reviewId_createdAt_idx" ON "ReviewModerationHistory"("reviewId", "createdAt");
ALTER TABLE "ReviewModerationHistory" ADD CONSTRAINT "ReviewModerationHistory_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewModerationHistory" ADD CONSTRAINT "ReviewModerationHistory_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
