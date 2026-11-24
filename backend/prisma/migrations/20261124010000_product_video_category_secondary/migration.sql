ALTER TABLE "Category" ADD COLUMN "secondaryImageUrl" TEXT, ADD COLUMN "secondaryImagePublicId" TEXT;
ALTER TABLE "Product" ADD COLUMN "videoUrl" TEXT, ADD COLUMN "videoPublicId" TEXT, ADD COLUMN "showInHomeVideoShowcase" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD CONSTRAINT "Product_homeVideo_requires_url" CHECK (NOT "showInHomeVideoShowcase" OR ("videoUrl" IS NOT NULL AND length(trim("videoUrl")) > 0));
CREATE INDEX "Product_status_showInHomeVideoShowcase_idx" ON "Product"("status", "showInHomeVideoShowcase");
