-- Category administration: additive status, soft deletion, and one optional category image.
-- Existing categories remain visible and active after this migration.
CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "Category"
  ADD COLUMN "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "imagePublicId" TEXT,
  ADD COLUMN "imageFormat" TEXT,
  ADD COLUMN "imageWidth" INTEGER,
  ADD COLUMN "imageHeight" INTEGER,
  ADD COLUMN "imageResourceType" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Category_status_deletedAt_name_idx" ON "Category"("status", "deletedAt", "name");
