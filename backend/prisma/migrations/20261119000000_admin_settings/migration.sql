CREATE TABLE "StoreSettings" (
  "id" TEXT NOT NULL DEFAULT 'store',
  "storeName" TEXT NOT NULL DEFAULT 'Home & Lifestyle',
  "supportEmail" TEXT,
  "supportPhone" TEXT,
  "storeVersion" INTEGER NOT NULL DEFAULT 0,
  "shippingVersion" INTEGER NOT NULL DEFAULT 0,
  "giftingVersion" INTEGER NOT NULL DEFAULT 0,
  "thresholdBasis" TEXT NOT NULL DEFAULT 'AFTER_DISCOUNTS',
  "waiveHandlingOnFree" BOOLEAN NOT NULL DEFAULT false,
  "giftWrapDefaultEligible" BOOLEAN NOT NULL DEFAULT false,
  "giftMessagesAvailable" BOOLEAN NOT NULL DEFAULT false,
  "giftReceiptsAvailable" BOOLEAN NOT NULL DEFAULT false,
  "giftWrapFeePaise" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "PinCodeServiceability" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
