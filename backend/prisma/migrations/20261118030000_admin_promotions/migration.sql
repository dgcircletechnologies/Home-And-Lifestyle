ALTER TABLE "Coupon" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Coupon" ADD COLUMN "lifecycle" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Coupon" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'CART';
ALTER TABLE "Promotion" ADD COLUMN "lifecycle" TEXT NOT NULL DEFAULT 'DRAFT';
CREATE INDEX "Coupon_lifecycle_enabled_startsAt_expiresAt_idx" ON "Coupon"("lifecycle", "enabled", "startsAt", "expiresAt");
CREATE INDEX "Promotion_lifecycle_enabled_startsAt_endsAt_idx" ON "Promotion"("lifecycle", "enabled", "startsAt", "endsAt");
CREATE UNIQUE INDEX "Coupon_code_normalized_key" ON "Coupon" (UPPER(BTRIM("code")));
