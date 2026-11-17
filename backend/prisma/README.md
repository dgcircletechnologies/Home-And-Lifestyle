## Email activation / JWT update — 17 November 2026

`20261117010000_email_activation_jwt` adds User.emailOriginal/emailVerifiedAt, Session.revokedAt, EmailVerification, RefreshCredential and AuthThrottle. Existing email remains the canonical unique key. The migration refuses case-fold collisions, preserves existing display addresses, normalizes keys and adds a SQL canonical-key CHECK. Existing sessions are revoked; existing users remain unverified. It neither deletes accounts nor resets passwords or commerce data. Email-verification purpose is constrained by a SQL CHECK. Locks/transactions serialize consumption, resend, refresh and account throttling. The local read-only preflight found zero users and zero canonical conflicts. See root README for the current policy; older sections below describe historical foundation behavior.

## Authentication foundation update — 17 November 2026

`auth/user.prisma` adds Role (CUSTOMER, ADMIN), User and Session. User owns normalized unique email, password hash, explicit role, disabled/deleted timestamps and an optional unique Customer relation. Customer gains only the inverse relation (no stored column). Session stores a unique token digest, expiry, user FK and cleanup indexes. The additive `20261117000000_auth_foundation` migration creates these objects inside a transaction; no existing rows are backfilled, linked or promoted. The prior migrations remain unchanged. Credentials are separate from commerce profiles to avoid claiming existing data with unverified email. Runtime workflows and approved scope are documented in the root README and AGENTS.md. The audit below is historical and predates this foundation.

# Prisma schema audit and migration notes

Audit date: 16 November 2026. Current local `main` checkout, including untracked files, is the baseline.

## Ownership

The schema directory contains 42 models and 5 enums. The original 13 models and ProductStatus enum retain every field, relation name, mapping, index, unique constraint, default and referential action. No model used `@@map` or `@map`. PostgreSQL table/column names remain the Prisma names.

| File | Definitions |
| --- | --- |
| `catalogue/attribute.prisma` | ProductAttribute, ProductCustomisation |
| `catalogue/category.prisma` | Category, ProductCategory |
| `catalogue/image.prisma` | ProductImage, VariantImage |
| `catalogue/merchandising.prisma` | Collection, ProductCollection, Tag, ProductTag |
| `catalogue/option.prisma` | ProductOption, ProductOptionValue, VariantOptionSelection |
| `catalogue/product.prisma` | ProductStatus, Product, ProductVariant |
| `checkout/cart.prisma` | Cart, CartLine, Wishlist, WishlistItem |
| `corporate-gifting/enquiry.prisma` | CorporateEnquiry |
| `customers/customer.prisma` | Customer, CustomerAddress |
| `editorial/page.prisma` | EditorialPage, EditorialProduct |
| `inventory/bundle.prisma` | BundleComponent |
| `orders/order.prisma` | Order, OrderLine, OrderAdjustment, AdjustmentKind |
| `payments/payment.prisma` | PaymentAttempt, PaymentEvent, Refund, PaymentStatus |
| `promotions/coupon.prisma` | Coupon, DiscountKind, CouponProduct, CouponCategory, CouponCollection, CouponRedemption, Promotion |
| `reviews/review.prisma` | Review, ModerationStatus |
| `schema.prisma` | Shared generator and PostgreSQL datasource |
| `shipping/shipping.prisma` | PinCodeServiceability, ShippingRule, Shipment, ShipmentLine |

## Original contract inventory

All IDs were String UUID defaults except explicit join keys. Timestamps, where present, use `now()` and `@updatedAt`. The inventory below records the original field and constraint declarations, including composite relation identities. Formatting alone is normalised.

### ProductStatus

```prisma
enum ProductStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

### Category

```prisma
model Category {
  id String @id @default(uuid())
  name String
  slug String @unique
  description String?
  parentId String?
  parent Category? @relation("CategoryHierarchy", fields: [parentId], references: [id], onDelete: Restrict)
  children Category[] @relation("CategoryHierarchy")
  products ProductCategory[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([parentId])
}
```

### Product

```prisma
model Product {
  id String @id @default(uuid())
  name String
  slug String @unique
  description String
  status ProductStatus @default(DRAFT)
  isFeatured Boolean @default(false)
  categories ProductCategory[]
  collections ProductCollection[]
  tags ProductTag[]
  variants ProductVariant[]
  options ProductOption[]
  images ProductImage[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([status, isFeatured])
}
```

### ProductCategory

```prisma
model ProductCategory {
  productId String
  categoryId String
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  @@id([productId, categoryId])
  @@index([categoryId])
}
```

### ProductVariant

```prisma
model ProductVariant {
  id String @id @default(uuid())
  productId String
  sku String @unique
  pricePaise Int
  stockQuantity Int @default(0)
  optionCombinationKey String
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  selections VariantOptionSelection[]
  images VariantImage[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([productId, optionCombinationKey])
  @@unique([id, productId])
}
```

### ProductOption

```prisma
model ProductOption {
  id String @id @default(uuid())
  productId String
  name String
  key String
  position Int @default(0)
  product Product @relation(fields: [productId], references: [id], onDelete: Restrict)
  values ProductOptionValue[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([productId, key])
  @@unique([id, productId])
}
```

### ProductOptionValue

```prisma
model ProductOptionValue {
  id String @id @default(uuid())
  optionId String
  productId String
  label String
  key String
  position Int @default(0)
  option ProductOption @relation(fields: [optionId, productId], references: [id, productId], onDelete: Restrict)
  selections VariantOptionSelection[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([optionId, key])
  @@unique([id, optionId, productId])
}
```

### VariantOptionSelection

```prisma
model VariantOptionSelection {
  variantId String
  productId String
  optionId String
  valueId String
  variant ProductVariant @relation(fields: [variantId, productId], references: [id, productId], onDelete: Cascade)
  value ProductOptionValue @relation(fields: [valueId, optionId, productId], references: [id, optionId, productId], onDelete: Restrict)
  @@id([variantId, optionId])
  @@index([valueId, optionId, productId])
}
```

### ProductImage

```prisma
model ProductImage {
  id String @id @default(uuid())
  productId String
  url String
  altText String?
  cloudinaryPublicId String?
  position Int @default(0)
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([productId, position, id])
}
```

### VariantImage

```prisma
model VariantImage {
  id String @id @default(uuid())
  variantId String
  url String
  altText String?
  cloudinaryPublicId String?
  position Int @default(0)
  variant ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([variantId, position, id])
}
```

### Collection

```prisma
model Collection {
  id String @id @default(uuid())
  name String
  slug String @unique
  description String?
  products ProductCollection[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### ProductCollection

```prisma
model ProductCollection {
  productId String
  collectionId String
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  collection Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  @@id([productId, collectionId])
  @@index([collectionId])
}
```

### Tag

```prisma
model Tag {
  id String @id @default(uuid())
  name String
  slug String @unique
  products ProductTag[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### ProductTag

```prisma
model ProductTag {
  productId String
  tagId String
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  tag Tag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([productId, tagId])
  @@index([tagId])
}
```

## Requirement coverage and intentional additions

| Requirements | Persistence added or extended |
| --- | --- |
| CAT-01, UX-01, MKT-01 | Product story, care, materials, dimension objects and SEO; variant product/packed dimensions, compare-at selling-price display, fragile/bulky and limited/unique flags; set piece counts; ProductAttribute typed facets; ProductCustomisation definitions; ordered/timed collections. Existing hierarchy, options, SKUs, galleries, tags and featured flag reused. Paintings need category data, not a new model. |
| CAT-01, ORD-01 | BundleComponent connects existing sellable SKUs and component quantities. Stock remains solely in ProductVariant.stockQuantity. No warehouse or reservation policy invented. |
| ORD-01 | Customer, CustomerAddress, Cart/CartLine, Wishlist/WishlistItem; optional customer ownership and hashed guest tokens. Gift/customisation JSON on carts supports approved future option contracts without imposing fees or receipts. |
| ORD-01, SHP-01 | Order/OrderLine retain required purchase-time product/variant IDs, names, SKU, prices, options, discounts, totals and delivery-address snapshots; OrderAdjustment records line quantities for cancellation/return requests. Shipment/ShipmentLine support quantities and tracking, with composite FKs enforcing the same order. |
| ORD-01 | PaymentAttempt, PaymentEvent and Refund store attempt outcomes, processing state and scoped deduplication. Refund FK enforces the payment's provider/account. Provider order ID is indexed but deliberately not unique: retries may share it. Nullable provider payment/refund references allow pending attempts. |
| SHP-01 | PinCodeServiceability and disabled-by-default ShippingRule selectors for location, dimensions/weight, category/product, charges, included/free shipping, threshold and separate dispatch/delivery estimates. No rates or precedence seeded. |
| MKT-01 | Coupon, three eligibility joins, CouponRedemption snapshots, Promotion. Fixed paise or integer percentage basis points, limits, validity, nullable stacking policy and product/category sales. No promotion enabled by default. |
| BUS-01, MKT-01 | CorporateEnquiry is independent of orders, with company/contact, quantity, interest, customisation, message, branding and quotation request; status/time queue index. |
| UX-01, ADM-01 | Review with moderation state; EditorialPage and EditorialProduct for managed pages, mood/Shop the Look links and optional hotspots. SEO/canonical fields on products and pages. No speculative staff-role schema. |
| ENG-01 | Directory schema config, unchanged client output/module format, format/test scripts, migration and isolated integration verification. |

## Migration safety

- Original untracked `20261116000000_init_catalogue/migration.sql` and lock file are byte-for-byte unchanged. Its seven SQL-only checks remain: nonnegative variant price/stock; image/option positions; no category self-parent.
- New `20261116010000_complete_business_schema/migration.sql` is a transaction containing additive columns, new tables/enums, indexes, FKs and 80 SQL CHECK constraints. No DROP, table recreation, monetary conversion or update/backfill of existing values. Existing rows receive nulls or neutral false/empty-array/zero defaults only. Required snapshot fields occur only on newly created tables.
- New checks on existing tables concern new fields: nullable packed measurements/compare-at price, false-by-default one-of-a-kind flag and zero-default collection position. Existing catalogue values are preserved. One-of-a-kind stock is constrained to at most one when the flag is enabled.
- Money remains PostgreSQL INTEGER paise. Percentages use integer basis points (1–10000). Numeric attributes use exact Decimal(18,6). Hotspots use exact Decimal(5,4).
- History relations restrict order/payment/refund/fulfilment deletion. Catalogue links on order lines use SET NULL while required snapshots survive. Customer deletion detaches purchase history. Reference data used by active configuration uses RESTRICT. Existing catalogue deletion actions were not changed.
- Generated SQL was reviewed before use. SQL CHECK constraints are maintained in migration SQL because Prisma cannot describe them; `migrate diff` does not prove checks exist. The integration test exercises representative SQL checks directly.
- No migrations were committed in the initial checkout. An existing `home-lifestyle-decor_postgres_data` volume was found but never mounted, started or modified. No Docker containers were running. The configured development host `postgres` could not resolve (EAI_AGAIN), so its row counts and applied migration ledger remain unknown. Do not treat this as an empty database.
- Before applying to a real development/deployed database: inspect `_prisma_migrations`, compare its schema with the local initial migration, back up data, and check for drift. If the initial schema was created outside Prisma, reconcile/baseline it explicitly after comparison; do not blindly replay CREATE statements or rewrite the preserved migration.

## Application contracts and decisions still required

No new customer/admin HTTP workflow is implemented in this schema-only task. The existing HTTP entry point is `/api/health`; the existing catalogue variant helper remains unchanged. Persistence is not enforcement of the following business behavior:

- **D01/D02/D03:** launch scope, catalogue hierarchy/units and content ownership. Product/variant `dimensions` must be a validated value/unit object; packed sizes are explicitly millimetres and grams. Customisation `configuration`, input type and selected values need a versioned validator. Sets are stocked SKUs with piece counts; bundles use component rows. Attribute keys/values and canonical option combinations need normalisation. Reject category/bundle cycles transactionally (SQL only prevents direct self-links).
- **D04:** inventory source, stock accounting for bundles, reservations, release timing, warehouses and pre-orders. No reservation/warehouse/pre-order tables or behaviors added. Atomic conditional stock writes, concurrency control and bundle-cycle/quantity checks are required; flags alone cannot prevent overselling. Existing stockQuantity remains the authoritative field.
- **D05:** PIN coverage, rate composition, free-shipping threshold basis, carrier and split shipment pricing. Rule selectors are conjunctive, but resolution of multiple matching rules is intentionally unimplemented; null charges do not mean free delivery. Single or multiple shipments are representable, but split fulfilment is not approved/enabled. Enforce sum(shipped quantities) <= purchased quantities transactionally and prevent cross-line allocation races. Validate delivery address and configured PIN coverage server-side.
- **D06:** gateway/methods (including COD), tax-inclusive/exclusive calculation, GST/invoice and refunds. No provider chosen or invoice/tax policy invented. Required order totals are supplied only by server recalculation; optional taxPaise is not an implicit zero. Snapshot all applied rules and per-line refund allocations. Use canonical provider/account identifiers (including environment), verify signatures/provider responses before writing events, atomically deduplicate and apply effects, reconcile pending attempts, and bound total successful refunds by the paid amount. Payment/refund status transitions require application validation; shared status enum is storage vocabulary, not a transition policy.
- **D07:** return/cancellation windows, quantity eligibility, damage evidence, reverse logistics and refund rules. OrderAdjustment has no auto-approved defaults; enforce aggregate returned/cancelled quantities and status transitions. Refund allocationSnapshot must capture line/quantity attribution under the approved policy.
- **D08:** customer identity, guest lookup/token expiry, wishlist persistence/merge, staff permissions, review eligibility/moderation and notification providers/events. Do not expose an order by orderNumber alone. Hash guest tokens, authorise customer ownership, normalise email before unique writes, protect snapshots/PII, and implement staff authorisation before admin access. No sign-in, notifications, review-purchase enforcement or staff role policy introduced.
- **D09:** coupon eligibility semantics for empty/multiple scopes, stacking/precedence, counting/reserving usage, per-customer identity and partial refunds; gift fees, per-line/order selection and receipt policy; enquiry routing/statuses. Disabled promotions require approved resolution before activation. Normalise coupon codes before writes. Redemption rows preserve evidence but do not enforce race-safe usage limits. Gift JSON has no receipt/fee defaults. Enquiry interestDescription should snapshot selected product/category text so context survives removal.
- **D10:** actual local data/migration ledger, deployment and analytics choices remain to be reviewed. Current Next.js/NestJS/PostgreSQL/Prisma retained for this task, not a hosting decision.
- Order/address/options/discount/gift JSON must be validated and treated as immutable after purchase. Order snapshots and reconciliation/fulfilment writes require server authorisation. Snapshot shipping and per-item fee allocations where needed for refunds. Reject unsafe integer totals and apply INR rounding consistently. Neither JSON columns nor database CHECKs replace checkout arithmetic validation.
- Search, recently viewed items, SEO sitemap generation, image delivery, analytics and notification sending do not each require a new table. Editorial JSON can hold approved media references, but content publication/UGC approval and editing access need an agreed application workflow.

## Reproduction and verification

Run from `backend/`:

```sh
npm run prisma:format
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run build
npm run lint
# Create a NEW disposable database named prisma_schema_test_* first.
TEST_DATABASE_URL='<disposable connection>' npm run prisma:test
# Separately, against a fresh disposable database only:
DATABASE_URL='<disposable connection>' npx prisma migrate deploy
DATABASE_URL='<disposable connection>' npx prisma migrate diff --from-config-datasource --to-schema prisma --exit-code
```

The integration test refuses a nonempty database and never reads DATABASE_URL. It installs the preserved initial migration, inserts existing catalogue data, applies the additive migration, verifies preservation, and exercises guest-order snapshots, cross-order FKs, provider/account scope, duplicate events, SQL checks, history retention and independent enquiries. Test fixtures stay in the disposable database for inspection.

The file-only move was checked BEFORE additions with `prisma migrate diff --from-schema <temporary baseline> --to-schema prisma --exit-code`: no difference. A separate declaration comparison verified every original field/enum/relation/index/default remained unchanged. Temporary baselines and original-file hashes live outside the repository.

Installed Node 24.13.0 and Prisma/client/adapter 7.10.1 were retained. Migration tests passed both on an isolated PostgreSQL 16.15 cluster under `/tmp` and a disposable PostgreSQL 17.12 Docker container (the project engine version), with loopback-only ports and ephemeral storage. No configured database or existing volume was changed. Clean migration deploy and database-to-schema diff passed; format, validate, generate, backend typecheck/build/lint and health endpoint checks passed. There were no pre-existing test/seed/CI definitions.

Dockerfile already copies the whole backend, and Compose mounts the whole prisma directory; neither excludes nested definitions. No client import paths changed. Docker image build passed, as did runtime validation/generation with the final schema directory mounted read-only (matching Compose discovery). `docker compose config --quiet` passed. The original generated-client catalogue helper created a SKU and rejected foreign option values successfully. All 87 public CHECK constraints (7 preserved + 80 new) were confirmed in PostgreSQL 17.12. Git index preservation, original migration/lock/helper hashes and `git diff --check` passed. Test services were stopped after verification. Real configured-database ledger/data inspection remains outstanding.

