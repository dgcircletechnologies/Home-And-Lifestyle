-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "billingAddress" JSONB,
ADD COLUMN     "couponCodeSnapshot" TEXT,
ADD COLUMN     "sourceMode" TEXT NOT NULL DEFAULT 'CART';

-- AlterTable
ALTER TABLE "PaymentAttempt" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "providerSignature" TEXT;

