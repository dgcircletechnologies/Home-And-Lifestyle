ALTER TABLE "Product" ADD COLUMN "showInHeroCarousel" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Product_status_showInHeroCarousel_idx" ON "Product"("status", "showInHeroCarousel");
