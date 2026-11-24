ALTER TABLE "OrderStatusHistory"
  ALTER COLUMN "adminId" DROP NOT NULL,
  ALTER COLUMN "previousStatus" DROP NOT NULL,
  ADD COLUMN "paymentStatus" "PaymentStatus",
  ADD COLUMN "actorType" TEXT NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN "note" TEXT,
  ADD COLUMN "internalNote" TEXT;

ALTER TABLE "OrderStatusHistory" DROP CONSTRAINT "OrderStatusHistory_orderId_fkey";
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderStatusHistory" DROP CONSTRAINT "OrderStatusHistory_adminId_fkey";
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "OrderStatusHistory" SET "internalNote" = "reason" WHERE "reason" IS NOT NULL;
