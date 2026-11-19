ALTER TABLE "Category" ADD COLUMN "showInStorefrontNav" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Category" ADD COLUMN "storefrontNavPosition" INTEGER;
CREATE INDEX "Category_showInStorefrontNav_storefrontNavPosition_idx" ON "Category"("showInStorefrontNav", "storefrontNavPosition");
ALTER TABLE "StoreSettings" ADD COLUMN "navigationVersion" INTEGER NOT NULL DEFAULT 0;

-- Carry over only unambiguous, existing top-level matches from the former header.
-- This migration runs once; normal startup and development seeds never reapply it.
WITH legacy(name, position) AS (
  VALUES ('Kitchen & Dining', 0), ('Lighting', 1), ('Planters & Greenery', 2), ('Soft Furnishings', 3)
), matches AS (
  SELECT c.id, legacy.position, count(*) OVER (PARTITION BY legacy.name) AS match_count
  FROM legacy JOIN "Category" c ON lower(c.name) = lower(legacy.name)
  WHERE c."parentId" IS NULL AND c."deletedAt" IS NULL
)
UPDATE "Category" c SET "showInStorefrontNav" = true, "storefrontNavPosition" = matches.position
FROM matches WHERE c.id = matches.id AND matches.match_count = 1;
