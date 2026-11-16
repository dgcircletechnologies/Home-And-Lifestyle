BEGIN;

-- CreateEnum
CREATE TYPE "AdjustmentKind" AS ENUM ('CANCELLATION', 'RETURN');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "DiscountKind" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "canonicalUrl" TEXT,
ADD COLUMN     "careInstructions" TEXT,
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "giftWrapEligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "materials" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "story" TEXT;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "compareAtPricePaise" INTEGER,
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "isBulky" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFragile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isLimitedStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isOneOfAKind" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "packedHeightMm" INTEGER,
ADD COLUMN     "packedLengthMm" INTEGER,
ADD COLUMN     "packedWeightGrams" INTEGER,
ADD COLUMN     "packedWidthMm" INTEGER,
ADD COLUMN     "setPieceCount" INTEGER;

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProductCollection" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ProductAttribute" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "textValue" TEXT,
    "numericValue" DECIMAL(18,6),
    "unit" TEXT,

    CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCustomisation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "inputType" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "configuration" JSONB NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductCustomisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "guestTokenHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "giftOptions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartLine" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "giftOptions" JSONB,
    "customisationValues" JSONB,

    CONSTRAINT "CartLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "guestTokenHash" TEXT,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "wishlistId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("wishlistId","productId")
);

-- CreateTable
CREATE TABLE "CorporateEnquiry" (
    "id" TEXT NOT NULL,
    "companyName" TEXT,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "productId" TEXT,
    "categoryId" TEXT,
    "interestDescription" TEXT,
    "customisation" TEXT,
    "personalMessage" TEXT,
    "brandingInstructions" TEXT,
    "quotationRequested" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorporateEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pinCode" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'IN',

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "canonicalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialProduct" (
    "pageId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "hotspotX" DECIMAL(5,4),
    "hotspotY" DECIMAL(5,4),

    CONSTRAINT "EditorialProduct_pkey" PRIMARY KEY ("pageId","productId")
);

-- CreateTable
CREATE TABLE "BundleComponent" (
    "bundleVariantId" TEXT NOT NULL,
    "componentVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "BundleComponent_pkey" PRIMARY KEY ("bundleVariantId","componentVariantId")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "checkoutKey" TEXT NOT NULL,
    "customerId" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "deliveryAddress" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "subtotalPaise" INTEGER NOT NULL,
    "discountPaise" INTEGER NOT NULL,
    "shippingPaise" INTEGER NOT NULL,
    "taxPaise" INTEGER,
    "giftFeePaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "giftOptions" JSONB,
    "shippingQuoteSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "productIdSnapshot" TEXT NOT NULL,
    "variantIdSnapshot" TEXT NOT NULL,
    "discountsSnapshot" JSONB NOT NULL,
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT,
    "productName" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPricePaise" INTEGER NOT NULL,
    "discountPaise" INTEGER NOT NULL,
    "taxPaise" INTEGER,
    "totalPaise" INTEGER NOT NULL,
    "optionsSnapshot" JSONB NOT NULL,
    "giftOptions" JSONB,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAdjustment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "kind" "AdjustmentKind" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccount" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "providerOrderId" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccount" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccount" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "providerRefundId" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "allocationSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "kind" "DiscountKind" NOT NULL,
    "amountPaise" INTEGER,
    "percentBasisPoints" INTEGER,
    "minimumCartPaise" INTEGER,
    "maximumDiscountPaise" INTEGER,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "perCustomerLimit" INTEGER,
    "stackingGroup" TEXT,
    "allowStacking" BOOLEAN,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponProduct" (
    "couponId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "CouponProduct_pkey" PRIMARY KEY ("couponId","productId")
);

-- CreateTable
CREATE TABLE "CouponCategory" (
    "couponId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "CouponCategory_pkey" PRIMARY KEY ("couponId","categoryId")
);

-- CreateTable
CREATE TABLE "CouponCollection" (
    "couponId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,

    CONSTRAINT "CouponCollection_pkey" PRIMARY KEY ("couponId","collectionId")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT,
    "orderId" TEXT NOT NULL,
    "codeSnapshot" TEXT NOT NULL,
    "discountPaise" INTEGER NOT NULL,
    "rulesSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "productId" TEXT,
    "categoryId" TEXT,
    "kind" "DiscountKind" NOT NULL,
    "amountPaise" INTEGER,
    "percentBasisPoints" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PinCodeServiceability" (
    "pinCode" TEXT NOT NULL,
    "supported" BOOLEAN NOT NULL,
    "reason" TEXT,
    "dispatchMinDays" INTEGER,
    "dispatchMaxDays" INTEGER,
    "deliveryMinDays" INTEGER,
    "deliveryMaxDays" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PinCodeServiceability_pkey" PRIMARY KEY ("pinCode")
);

-- CreateTable
CREATE TABLE "ShippingRule" (
    "minLengthMm" INTEGER,
    "minWidthMm" INTEGER,
    "minHeightMm" INTEGER,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "pinCode" TEXT,
    "state" TEXT,
    "productId" TEXT,
    "categoryId" TEXT,
    "minWeightGrams" INTEGER,
    "maxWeightGrams" INTEGER,
    "maxLengthMm" INTEGER,
    "maxWidthMm" INTEGER,
    "maxHeightMm" INTEGER,
    "baseChargePaise" INTEGER,
    "fragileChargePaise" INTEGER,
    "bulkyChargePaise" INTEGER,
    "freeShippingThresholdPaise" INTEGER,
    "shippingIncluded" BOOLEAN,
    "freeShipping" BOOLEAN,
    "dispatchMinDays" INTEGER,
    "dispatchMaxDays" INTEGER,
    "deliveryMinDays" INTEGER,
    "deliveryMaxDays" INTEGER,

    CONSTRAINT "ShippingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "status" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "estimatedDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentLine" (
    "shipmentId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ShipmentLine_pkey" PRIMARY KEY ("shipmentId","orderLineId")
);

-- CreateIndex
CREATE INDEX "ProductAttribute_key_textValue_idx" ON "ProductAttribute"("key", "textValue");

-- CreateIndex
CREATE INDEX "ProductAttribute_key_numericValue_idx" ON "ProductAttribute"("key", "numericValue");

-- CreateIndex
CREATE INDEX "ProductAttribute_productId_idx" ON "ProductAttribute"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCustomisation_productId_key_key" ON "ProductCustomisation"("productId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_guestTokenHash_key" ON "Cart"("guestTokenHash");

-- CreateIndex
CREATE INDEX "Cart_customerId_idx" ON "Cart"("customerId");

-- CreateIndex
CREATE INDEX "CartLine_cartId_idx" ON "CartLine"("cartId");

-- CreateIndex
CREATE INDEX "CartLine_variantId_idx" ON "CartLine"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_guestTokenHash_key" ON "Wishlist"("guestTokenHash");

-- CreateIndex
CREATE INDEX "Wishlist_customerId_idx" ON "Wishlist"("customerId");

-- CreateIndex
CREATE INDEX "WishlistItem_productId_idx" ON "WishlistItem"("productId");

-- CreateIndex
CREATE INDEX "CorporateEnquiry_status_createdAt_idx" ON "CorporateEnquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CorporateEnquiry_productId_idx" ON "CorporateEnquiry"("productId");

-- CreateIndex
CREATE INDEX "CorporateEnquiry_categoryId_idx" ON "CorporateEnquiry"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "CustomerAddress_customerId_idx" ON "CustomerAddress"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialPage_slug_key" ON "EditorialPage"("slug");

-- CreateIndex
CREATE INDEX "EditorialPage_kind_publishedAt_idx" ON "EditorialPage"("kind", "publishedAt");

-- CreateIndex
CREATE INDEX "EditorialProduct_productId_idx" ON "EditorialProduct"("productId");

-- CreateIndex
CREATE INDEX "BundleComponent_componentVariantId_idx" ON "BundleComponent"("componentVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_checkoutKey_key" ON "Order"("checkoutKey");

-- CreateIndex
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");

-- CreateIndex
CREATE INDEX "OrderLine_variantId_idx" ON "OrderLine"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLine_id_orderId_key" ON "OrderLine"("id", "orderId");

-- CreateIndex
CREATE INDEX "OrderAdjustment_orderLineId_orderId_idx" ON "OrderAdjustment"("orderLineId", "orderId");

-- CreateIndex
CREATE INDEX "OrderAdjustment_status_createdAt_idx" ON "OrderAdjustment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentAttempt_provider_providerAccount_providerOrderId_idx" ON "PaymentAttempt"("provider", "providerAccount", "providerOrderId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_orderId_status_idx" ON "PaymentAttempt"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_provider_providerAccount_idempotencyKey_key" ON "PaymentAttempt"("provider", "providerAccount", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_provider_providerAccount_providerPaymentId_key" ON "PaymentAttempt"("provider", "providerAccount", "providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_id_provider_providerAccount_key" ON "PaymentAttempt"("id", "provider", "providerAccount");

-- CreateIndex
CREATE INDEX "PaymentEvent_processedAt_receivedAt_idx" ON "PaymentEvent"("processedAt", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_provider_providerAccount_providerEventId_key" ON "PaymentEvent"("provider", "providerAccount", "providerEventId");

-- CreateIndex
CREATE INDEX "Refund_paymentId_provider_providerAccount_idx" ON "Refund"("paymentId", "provider", "providerAccount");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_provider_providerAccount_idempotencyKey_key" ON "Refund"("provider", "providerAccount", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_provider_providerAccount_providerRefundId_key" ON "Refund"("provider", "providerAccount", "providerRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "CouponProduct_productId_idx" ON "CouponProduct"("productId");

-- CreateIndex
CREATE INDEX "CouponCategory_categoryId_idx" ON "CouponCategory"("categoryId");

-- CreateIndex
CREATE INDEX "CouponCollection_collectionId_idx" ON "CouponCollection"("collectionId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_orderId_codeSnapshot_key" ON "CouponRedemption"("orderId", "codeSnapshot");

-- CreateIndex
CREATE INDEX "Promotion_productId_enabled_idx" ON "Promotion"("productId", "enabled");

-- CreateIndex
CREATE INDEX "Promotion_categoryId_enabled_idx" ON "Promotion"("categoryId", "enabled");

-- CreateIndex
CREATE INDEX "Review_productId_moderationStatus_createdAt_idx" ON "Review"("productId", "moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Review_customerId_idx" ON "Review"("customerId");

-- CreateIndex
CREATE INDEX "ShippingRule_pinCode_enabled_idx" ON "ShippingRule"("pinCode", "enabled");

-- CreateIndex
CREATE INDEX "ShippingRule_productId_idx" ON "ShippingRule"("productId");

-- CreateIndex
CREATE INDEX "ShippingRule_categoryId_idx" ON "ShippingRule"("categoryId");

-- CreateIndex
CREATE INDEX "Shipment_orderId_idx" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_carrier_trackingNumber_idx" ON "Shipment"("carrier", "trackingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_id_orderId_key" ON "Shipment"("id", "orderId");

-- CreateIndex
CREATE INDEX "ShipmentLine_orderLineId_orderId_idx" ON "ShipmentLine"("orderLineId", "orderId");

-- CreateIndex
CREATE INDEX "ShipmentLine_shipmentId_orderId_idx" ON "ShipmentLine"("shipmentId", "orderId");

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCustomisation" ADD CONSTRAINT "ProductCustomisation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "Wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateEnquiry" ADD CONSTRAINT "CorporateEnquiry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateEnquiry" ADD CONSTRAINT "CorporateEnquiry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialProduct" ADD CONSTRAINT "EditorialProduct_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "EditorialPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialProduct" ADD CONSTRAINT "EditorialProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleComponent" ADD CONSTRAINT "BundleComponent_bundleVariantId_fkey" FOREIGN KEY ("bundleVariantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleComponent" ADD CONSTRAINT "BundleComponent_componentVariantId_fkey" FOREIGN KEY ("componentVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAdjustment" ADD CONSTRAINT "OrderAdjustment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAdjustment" ADD CONSTRAINT "OrderAdjustment_orderLineId_orderId_fkey" FOREIGN KEY ("orderLineId", "orderId") REFERENCES "OrderLine"("id", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_provider_providerAccount_fkey" FOREIGN KEY ("paymentId", "provider", "providerAccount") REFERENCES "PaymentAttempt"("id", "provider", "providerAccount") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponProduct" ADD CONSTRAINT "CouponProduct_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponProduct" ADD CONSTRAINT "CouponProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCategory" ADD CONSTRAINT "CouponCategory_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCategory" ADD CONSTRAINT "CouponCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCollection" ADD CONSTRAINT "CouponCollection_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCollection" ADD CONSTRAINT "CouponCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_shipmentId_orderId_fkey" FOREIGN KEY ("shipmentId", "orderId") REFERENCES "Shipment"("id", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_orderLineId_orderId_fkey" FOREIGN KEY ("orderLineId", "orderId") REFERENCES "OrderLine"("id", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL invariants not expressible in Prisma schema syntax.
ALTER TABLE "PinCodeServiceability" ADD CONSTRAINT "PinCodeServiceability_dispatchMinDays_nonnegative" CHECK ("dispatchMinDays" >= 0);
ALTER TABLE "PinCodeServiceability" ADD CONSTRAINT "PinCodeServiceability_dispatchMaxDays_nonnegative" CHECK ("dispatchMaxDays" >= 0);
ALTER TABLE "PinCodeServiceability" ADD CONSTRAINT "PinCodeServiceability_deliveryMinDays_nonnegative" CHECK ("deliveryMinDays" >= 0);
ALTER TABLE "PinCodeServiceability" ADD CONSTRAINT "PinCodeServiceability_deliveryMaxDays_nonnegative" CHECK ("deliveryMaxDays" >= 0);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_minLengthMm_nonnegative" CHECK ("minLengthMm" >= 0);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_minWidthMm_nonnegative" CHECK ("minWidthMm" >= 0);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_minHeightMm_nonnegative" CHECK ("minHeightMm" >= 0);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_minWeightGrams_nonnegative" CHECK ("minWeightGrams" >= 0);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_maxWeightGrams_nonnegative" CHECK ("maxWeightGrams" >= 0);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_maxLengthMm_nonnegative" CHECK ("maxLengthMm" >= 0);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_maxWidthMm_nonnegative" CHECK ("maxWidthMm" >= 0);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_maxHeightMm_nonnegative" CHECK ("maxHeightMm" >= 0);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_baseChargePaise_nonnegative" CHECK ("baseChargePaise" >= 0);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_fragileChargePaise_nonnegative" CHECK ("fragileChargePaise" >= 0);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_bulkyChargePaise_nonnegative" CHECK ("bulkyChargePaise" >= 0);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_freeShippingThresholdPaise_nonnegative" CHECK ("freeShippingThresholdPaise" >= 0);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_dispatchMinDays_nonnegative" CHECK ("dispatchMinDays" >= 0);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_dispatchMaxDays_nonnegative" CHECK ("dispatchMaxDays" >= 0);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_deliveryMinDays_nonnegative" CHECK ("deliveryMinDays" >= 0);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_deliveryMaxDays_nonnegative" CHECK ("deliveryMaxDays" >= 0);
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_amountPaise_nonnegative" CHECK ("amountPaise" >= 0);
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_currency_inr" CHECK ("currency" = 'INR');
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amountPaise_nonnegative" CHECK ("amountPaise" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_subtotalPaise_nonnegative" CHECK ("subtotalPaise" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_discountPaise_nonnegative" CHECK ("discountPaise" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingPaise_nonnegative" CHECK ("shippingPaise" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_taxPaise_nonnegative" CHECK ("taxPaise" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_giftFeePaise_nonnegative" CHECK ("giftFeePaise" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_totalPaise_nonnegative" CHECK ("totalPaise" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_currency_inr" CHECK ("currency" = 'INR');
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_unitPricePaise_nonnegative" CHECK ("unitPricePaise" >= 0);
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_discountPaise_nonnegative" CHECK ("discountPaise" >= 0);
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_taxPaise_nonnegative" CHECK ("taxPaise" >= 0);
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_totalPaise_nonnegative" CHECK ("totalPaise" >= 0);
ALTER TABLE "OrderAdjustment" ADD CONSTRAINT "OrderAdjustment_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "BundleComponent" ADD CONSTRAINT "BundleComponent_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "ProductCollection" ADD CONSTRAINT "ProductCollection_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "ProductCustomisation" ADD CONSTRAINT "ProductCustomisation_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_compareAtPricePaise_nonnegative" CHECK ("compareAtPricePaise" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_packedLengthMm_nonnegative" CHECK ("packedLengthMm" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_packedWidthMm_nonnegative" CHECK ("packedWidthMm" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_packedHeightMm_nonnegative" CHECK ("packedHeightMm" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_packedWeightGrams_nonnegative" CHECK ("packedWeightGrams" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_setPieceCount_positive" CHECK ("setPieceCount" > 0);
ALTER TABLE "EditorialProduct" ADD CONSTRAINT "EditorialProduct_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "CorporateEnquiry" ADD CONSTRAINT "CorporateEnquiry_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_amountPaise_nonnegative" CHECK ("amountPaise" >= 0);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_minimumCartPaise_nonnegative" CHECK ("minimumCartPaise" >= 0);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_maximumDiscountPaise_nonnegative" CHECK ("maximumDiscountPaise" >= 0);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_usageLimit_positive" CHECK ("usageLimit" > 0);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_perCustomerLimit_positive" CHECK ("perCustomerLimit" > 0);
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_discountPaise_nonnegative" CHECK ("discountPaise" >= 0);
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_amountPaise_nonnegative" CHECK ("amountPaise" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_compareAtPrice_valid" CHECK ("compareAtPricePaise" IS NULL OR "compareAtPricePaise" >= "pricePaise");
ALTER TABLE "BundleComponent" ADD CONSTRAINT "BundleComponent_not_self" CHECK ("bundleVariantId" <> "componentVariantId");
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_one_value" CHECK (("textValue" IS NOT NULL)::int + ("numericValue" IS NOT NULL)::int = 1);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_discount_shape" CHECK (("kind" = 'FIXED' AND "amountPaise" > 0 AND "amountPaise" IS NOT NULL AND "percentBasisPoints" IS NULL) OR ("kind" = 'PERCENTAGE' AND "percentBasisPoints" BETWEEN 1 AND 10000 AND "percentBasisPoints" IS NOT NULL AND "amountPaise" IS NULL));
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_date_range" CHECK ("startsAt" IS NULL OR "expiresAt" IS NULL OR "startsAt" <= "expiresAt");
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_discount_shape" CHECK (("kind" = 'FIXED' AND "amountPaise" > 0 AND "amountPaise" IS NOT NULL AND "percentBasisPoints" IS NULL) OR ("kind" = 'PERCENTAGE' AND "percentBasisPoints" BETWEEN 1 AND 10000 AND "percentBasisPoints" IS NOT NULL AND "amountPaise" IS NULL));
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_date_range" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "startsAt" <= "endsAt");
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_one_target" CHECK (("productId" IS NOT NULL)::int + ("categoryId" IS NOT NULL)::int = 1);
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_pin_format" CHECK ("pinCode" ~ '^[1-9][0-9]{5}$');
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_dispatch_range" CHECK ("dispatchMinDays" <= "dispatchMaxDays");
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_delivery_range" CHECK ("deliveryMinDays" <= "deliveryMaxDays");
ALTER TABLE "PinCodeServiceability" ADD CONSTRAINT "PinCodeServiceability_pin_format" CHECK ("pinCode" ~ '^[1-9][0-9]{5}$');
ALTER TABLE "PinCodeServiceability" ADD CONSTRAINT "PinCodeServiceability_dispatch_range" CHECK ("dispatchMinDays" <= "dispatchMaxDays");
ALTER TABLE "PinCodeServiceability" ADD CONSTRAINT "PinCodeServiceability_delivery_range" CHECK ("deliveryMinDays" <= "deliveryMaxDays");
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_WeightGrams_range" CHECK ("minWeightGrams" <= "maxWeightGrams");
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_LengthMm_range" CHECK ("minLengthMm" <= "maxLengthMm");
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_WidthMm_range" CHECK ("minWidthMm" <= "maxWidthMm");
ALTER TABLE "ShippingRule" ADD CONSTRAINT "ShippingRule_HeightMm_range" CHECK ("minHeightMm" <= "maxHeightMm");
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_pin_format" CHECK ("pinCode" ~ '^[1-9][0-9]{5}$');
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_country_india" CHECK ("countryCode" = 'IN');
ALTER TABLE "EditorialProduct" ADD CONSTRAINT "EditorialProduct_hotspot_range" CHECK (("hotspotX" IS NULL AND "hotspotY" IS NULL) OR ("hotspotX" IS NOT NULL AND "hotspotY" IS NOT NULL AND "hotspotX" BETWEEN 0 AND 1 AND "hotspotY" BETWEEN 0 AND 1));

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_one_of_a_kind_stock" CHECK (NOT "isOneOfAKind" OR "stockQuantity" <= 1);

COMMIT;
