ALTER TABLE "CouponRedemption" ADD COLUMN "customerId" TEXT;
CREATE INDEX "CouponRedemption_couponId_customerId_idx" ON "CouponRedemption"("couponId", "customerId");
