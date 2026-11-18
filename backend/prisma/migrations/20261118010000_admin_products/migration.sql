-- Append-only product stock receipt ledger. ProductVariant.stockQuantity remains the current on-hand balance.
CREATE TABLE "ProductStockReceipt" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductStockReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductStockReceipt_operationId_key" UNIQUE ("operationId"),
  CONSTRAINT "ProductStockReceipt_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProductStockReceipt_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProductStockReceipt_quantity_check" CHECK ("quantity" > 0)
);
CREATE INDEX "ProductStockReceipt_variantId_createdAt_idx" ON "ProductStockReceipt"("variantId", "createdAt");
CREATE INDEX "ProductStockReceipt_adminId_createdAt_idx" ON "ProductStockReceipt"("adminId", "createdAt");
