-- AlterTable
ALTER TABLE "CustomerAddress" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "label" TEXT;

-- Existing saved addresses had no default flag. Choose one deterministically per customer.
WITH first_address AS (
  SELECT DISTINCT ON ("customerId") "id"
  FROM "CustomerAddress"
  ORDER BY "customerId", "id"
)
UPDATE "CustomerAddress" SET "isDefault" = true
WHERE "id" IN (SELECT "id" FROM first_address);

CREATE UNIQUE INDEX "CustomerAddress_one_default_per_customer"
ON "CustomerAddress" ("customerId") WHERE "isDefault" = true;
