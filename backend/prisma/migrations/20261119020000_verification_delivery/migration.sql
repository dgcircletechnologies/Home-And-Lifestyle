ALTER TABLE "EmailVerification" ADD COLUMN "deliveryAcceptedAt" TIMESTAMP(3);
ALTER TABLE "EmailVerification" ADD COLUMN "deliveryFailedAt" TIMESTAMP(3);
-- Retain the existing resend cooldown for records created before delivery tracking.
UPDATE "EmailVerification" SET "deliveryAcceptedAt" = "createdAt" WHERE "deliveryAcceptedAt" IS NULL AND "deliveryFailedAt" IS NULL;
