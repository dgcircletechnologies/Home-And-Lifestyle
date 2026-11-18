# Home and Lifestyle project requirements

Status: discovery baseline, 16 November 2026. Sources: the owner's project brief and home_decor_ecommerce_business_requirements(1).docx. The stack and launch priorities are pending. A requirement below describes intended scope. It does not establish that the feature exists in the repository or that it is scheduled for the first release.

## Instructions for Codex

- Read this file and applicable nested AGENTS.md files before changing code. Map the task to the relevant requirement IDs below and inspect existing entry points, schema ownership, data and tests before implementation.
- Treat the confirmed scope as the baseline. If a pending business decision materially changes prices, payments, inventory, permissions, fulfilment or customer commitments, ask for that decision before implementing the dependent behavior. Continue independent work within the task.
- Update this file when the owner approves a scope or policy change. Record which decisions changed and which requirement IDs they affect. Keep phase-specific prompts aligned with this file.
- Verify changes through the normal customer or admin entry point, run applicable repository checks, and report what was verified and what remains pending. Preserve existing interfaces and stored data unless an approved task calls for a migration.

## BUS-01 Business model and scope

- Single-brand direct-to-consumer store. The business sources products from suppliers and markets and sells under its own brand. Launch market is India, currency INR, language English, and delivery is limited to configured Indian PIN codes.
- Customer journeys cover guest buyers and account holders. Internal staff manage merchandise, inventory, orders and support. Third-party seller onboarding, seller dashboards, commissions and payouts are out of scope.
- Corporate gifting uses an enquiry and quotation request flow. Digital gift cards are a future enhancement. Availability of pre-orders, gift receipts and split shipments depends on approved operational rules.

## CAT-01 Catalogue and taxonomy

| Initial category group | Examples |
| --- | --- |
| Home décor | Vases, decorative objects, showpieces, sculptures, wall art, paintings, mirrors, clocks, table décor and centrepieces |
| Kitchen and dining | Mugs, plates, bowls, cutlery, trays, serveware, jars, kitchen accessories and table linen |
| Lighting | Table lamps, floor lamps, pendants and ambient lighting |
| Bedroom and soft furnishings | Throws, bedding accents, cushions and covers, rugs and bedside accessories |
| Planters and greenery | Planters, indoor pots, plant stands, artificial plants and flower arrangements |
| Lifestyle and gifting | Candles, stationery, gift sets and seasonal finds |

- Also support storage and organisation, bathroom accessories, festive décor and lifestyle accessories. Confirm their placement against the launch assortment. Proposed taxonomy for approval is Home Décor → Wall Art & Décor → Paintings, Prints, Wall Hangings and Metal Wall Art. Validate classification for mirrors and clocks during catalogue setup.
- Categories and subcategories describe product type. Room, style, colour, price, material and availability support discovery. Collections and tags support merchandising. Allow the catalogue to expand without a new schema per product type.
- Support articles sold singly or in predefined sets, curated bundles, variants by size, colour, material or finish, SKU tracking, variant-specific stock, price and images, configurable customisation fields, one-of-a-kind and limited-stock products, and optional pre-orders.
- Capture product title, description and story, attributes, dimensions and units, materials, care, multi-image gallery and image alt text. Capture packed dimensions and weight where needed for shipping. Keep product specs distinct from packed dimensions.

## UX-01 Storefront and brand

- Warm, playful, eclectic, editorial and contemporary. Use warm neutrals with selective cobalt, butter yellow, terracotta, olive, coral or lilac. Pair expressive display typography with a readable sans-serif. Use styled scenes, close-ups, cut-outs and usage photography.
- Homepage includes a campaign hero with one primary CTA, image-led category tiles, trending and new arrivals, bestsellers, curated edits, Shop the Look, Shop by Mood, editorial content, social proof and delivery/returns reassurance. Mood examples include Cozy Corners, Colour Therapy, Sunday Hosting and Maximalist Mood. Use shoppable hotspots or linked products/bundles. Provide a keyboard and touch equivalent for hotspots and hover-led interactions.
- Shop All, category and collection pages offer responsive product grids, sorting and filters for price, colour, material, room, style and availability. Cards show pricing, wishlist and quick add, with an alternate image where assets support it. Require variant selection before adding an ambiguous SKU.
- Provide search, recently viewed items and related products. Collections include New In, Bestsellers, Under ₹999, Giftable Finds, Colour Stories, Small-Space Picks and seasonal edits. Confirm collection membership rules and editorial ownership.
- Product detail includes images, story, dimensions, materials, care, variant selection, availability, delivery information, reviews and related products. Support About, Contact, FAQs, Shipping, Returns, Privacy and Terms pages. Community content includes approved UGC and an Instagram gallery.

## ORD-01 Cart, checkout and customer account

- Support wishlist, editable cart, guest checkout, customer accounts, payment, order confirmation, order history, tracking, cancellations and returns. Provide email and SMS notifications. Confirm guest lookup and wishlist persistence, account sign-in method, and notification events before implementation.
- Recalculate totals, eligible discounts, shipping and availability on the server when placing the order. Record the purchased variants, prices, discounts, shipping, taxes where applicable, gift/customisation selections and delivery address with the order so catalogue edits do not change order history.
- Evaluate Razorpay and Cashfree after payment requirements are agreed. Verify provider confirmation server-side. Make duplicate payment events and retries safe, and support reconciliation of pending, failed, successful and refunded payments.
- Agree inventory reservation and release timing. Verify simultaneous purchases cannot oversell limited-stock SKUs. Define failure recovery for abandoned checkout, expired reservations and payment received after expiry.

## SHP-01 Serviceability, fulfilment and returns

- Provide PIN-code checks on product pages and at checkout. Admin can configure supported and restricted regions, shipping rates by location, weight or dimensions, product and category overrides, shipping included in price, premium-product free shipping, and a free-shipping cart threshold.
- Support fragile and bulky handling with configurable charges. Display estimated dispatch and delivery separately when available. Confirm whether one order can be fulfilled in multiple shipments at launch, with tracking and quantities per shipment when enabled.
- Confirm how overlapping rules and surcharges are applied, how mixed carts and split shipments are priced, the threshold calculation basis, stocking locations, courier or aggregator, tracking updates, cancellation windows, return eligibility, damage handling and refunds. Keep these rules configurable.

## MKT-01 Promotions and gifting

- Support New Arrival, Best Seller, Trending, Premium, Handmade, Limited Edition and Festive Collection tags. Admin manages product/category discounts, featured items, collections and timed or curated merchandising. Display original and sale pricing clearly.
- Coupons support fixed or percentage discounts, cart minimums, expiry, usage limits, eligible products/categories/collections and configurable stacking. Confirm precedence, usage counting, discount allocation for partial refunds and whether requirements include per-customer limits.
- Provide eligible gift wrapping, personal messages and gift receipts where applicable. Confirm fees, whether gifting is per item or per order, and whether gift receipts omit prices. Confirm how bundle component stock, discounts and partial returns work.
- Corporate Gifting gets a dedicated page and separate admin queue. Form collects company/contact name, email, phone, quantity, product or category, customisation requirements, personalised messages and branding instructions, with a quotation request option. Deliver submissions to the admin team and make them reviewable independently of retail orders.

## ADM-01 Administration and quality

- Admin manages products, variants, SKUs, stock, image ordering, categories, subcategories, tags, prices, discounts, coupon activation, shipping, sales orders, payments, delivery statuses, and the corporate gifting queue. Confirm staff roles, permissions, catalogue import/export, editorial editing and review moderation rules.
- Support SEO metadata, canonical URLs, sitemap and structured product data appropriate to visible price and availability. Optimise image delivery and responsive sizes. Agree analytics metrics, event definitions, tooling, consent requirements and access. Protect account and admin data with server-side authorisation and keep credentials outside version control.
- Check keyboard navigation, contrast, focus, labelling and responsive layouts. Verify filters and sorting, unavailable variants, guest checkout, supported and blocked PIN codes, fragile/bulky rates, coupon limits, duplicate payment confirmation, stock contention, refunds, and separate enquiry handling. Agree performance budgets before launch.

## ENG-01 Schema ownership and repository review

- Promotions administration approval, 18 November 2026 (MKT-01, CAT-01, ENG-01): owner requires automatic product/category discounts, coupon codes, scheduling, pause/end lifecycle, eligibility and combination controls, and an admin-only cart quote. Variant `pricePaise` remains the selling price; `compareAtPricePaise` is display-only. Coupon usage is read from redemption rows. Customer checkout redemption and gateway/payment side effects remain outside this admin phase.

- Admin order operations approval, 18 November 2026 (ORD-01, ADM-01, ENG-01): the owner requires merchant decision states NEW, ACCEPTED, REJECTED and ON_HOLD, followed by PROCESSING, READY_TO_SHIP, SHIPPED and DELIVERED, with pre-dispatch CANCELLED. Holds retain the prior stage; reject, hold and cancel require a reason and actor history. Payment and shipment facts remain independent. Existing checkout, reservation, carrier, return and refund policies remain pending where no writer or integration exists.

- Product administration approval, 18 November 2026 (CAT-01, ADM-01, ENG-01): product price and on-hand stock remain owned by `ProductVariant.pricePaise` and `ProductVariant.stockQuantity`. Admin deletion archives via existing `ProductStatus.ARCHIVED`, preserving order-line snapshots and variant relations. Additive `ProductStockReceipt` rows provide idempotent receipt audit history; no warehouse/location or reservation policy is introduced.

- Category administration approval, 18 November 2026 (CAT-01, ADM-01, ENG-01): “catalog” in the admin request means the existing `Category` entity at `/admin/categories`. Categories now have an additive `ACTIVE`/`INACTIVE` status, soft deletion, and one optional Cloudinary-backed image; existing categories default to active and remain image-less until updated. Deletion is non-destructive and blocked while active relationships include child categories or product assignments. This does not change ProductImage or VariantImage ownership.

- Authentication policy update, 18 November 2026 (ORD-01, ADM-01, ENG-01, D08): owner requires email activation before customer or admin login, Argon2id for new passwords, 8–128-character passwords with compromised-password screening, JWT access tokens and rotating opaque refresh credentials. Registration and activation never establish sessions. This supersedes the foundation's verification-out-of-scope and opaque-access-session policy. Trusted admin provisioning may explicitly confirm email ownership; no legacy account is auto-verified. SMTP/Mailpit provide delivery/local testing; production provider credentials and deployment remain operator configuration. Root `.env` stays the only configuration source. No commerce or other D08 workflow changes are approved.

- Local configuration update, 17 November 2026 (ENG-01): owner requested root `.env` as the single configuration source, with frontend 5007, backend 9007 and loopback PostgreSQL 5437. Host Prisma uses DATABASE_URL; Compose injects DOCKER_DATABASE_URL for internal database networking. Frontend loads only explicitly public configuration and its port.

- Foundation approval, 17 November 2026 (ORD-01, ADM-01, ENG-01, D08/D10): owner authorised backend/frontend connectivity, customer registration, authentication and explicit CUSTOMER/ADMIN authorization within the existing stack. No additional roles existed. This phase chooses email/password with revocable database sessions; verification/recovery are outside scope, and email does not prove ownership of existing commerce profiles. ADMIN does not inherit CUSTOMER endpoints. New User/Session tables leave commerce data intact. Other D08 decisions (guest tracking, moderation, notifications and operational staff permissions) remain pending. See root README for session, bootstrap and deployment contracts.

- Local-checkout update, 16 November 2026 (ENG-01, D10): the owner supplied unpublished catalogue work and authorised retaining Next.js, NestJS, PostgreSQL and Prisma for this schema reorganisation task. The local baseline contained 13 catalogue models, ProductStatus, an untracked initial migration and a catalogue variant-writing helper. These supersede the GitHub-only absence-of-models finding below for this task. Domain schemas and an additive business migration now live under `backend/prisma/`; see `backend/prisma/README.md` for ownership, contract inventory, validation and pending policy decisions. The configured local database was unavailable and an existing PostgreSQL Docker volume was preserved; its migration/data state remains unverified. No pricing, payment, fulfilment, permissions or launch-policy decision is approved by this update.

- Verified GitHub default branch `main` at commit `a4a79699fd76fea0b7c05659c15d9cf235836e72`. It has independent Next.js and NestJS TypeScript apps, Docker Compose, PostgreSQL and Prisma 7. The storefront is a health smoke test. `backend/src/app.module.ts` exposes a health check. `backend/prisma/schema.prisma` contains only generator and datasource blocks. The inspected tree has no business model definitions or migrations. Review any other branch or unpublished checkout containing models before planning a refactor. Runtime checks were outside this documentation review.
- If Prisma is retained, use domain folders under the configured schema root, for example `backend/prisma/catalogue/` and `backend/prisma/orders/`. Keep the shared generator and datasource in `backend/prisma/schema.prisma` and migrations beside it. Configure `backend/prisma.config.ts` to load the schema directory and verify generation and migration commands through the existing Docker and local workflows. Keep feature request validators beside their owning feature. See [Prisma multi-file schema configuration](https://docs.prisma.io/docs/orm/v7/prisma-schema/overview/location).
- Put domain-owned schema definitions in their respective feature directories. Typical owners are catalogue, inventory, checkout, orders, payments, shipping, reviews and corporate gifting. Use the repository's conventions and the selected tooling's supported discovery or composition. Central entry points may register or compose domain definitions when the tooling requires them. Keep models and constraints defined once.
- Inventory cross-domain relations, types, mapped table/collection names, indexes, constraints and migration history. Preserve those contracts during a folder-only move. Keep generated clients and imports working, compare schema or migration output before and after, and validate against existing data in a safe environment. Plan any real data changes separately. Avoid resetting a populated database as part of reorganising files.
- Update this baseline if the owner provides another branch or source archive. Decide whether to retain the current stack and tooling after evaluating this baseline. The original discovery review approved no framework, database, ORM, integration or host; the task-specific stack retention above does not approve integrations or hosting.

## Decisions needed

| ID | Owner input needed | Work affected |
| --- | --- | --- |
| D01 | Launch date, must-have features, phased features, and who approves each phase | Scope and estimates |
| D02 | Brand name, domain, identity assets, copy and photography ownership | Storefront and editorial |
| D03 | Representative launch catalogue and category tree, attribute units, sample variant SKUs, bundle, limited-stock and fragile items, and optional pre-order/customised items if planned | Data model and UX |
| D04 | Inventory source, warehouse count, reservation timing, backorder/pre-order rules and bundle stock model | Stock and checkout |
| D05 | PIN-code coverage, dispatch origin, courier/aggregator, rate examples, free-shipping threshold and mixed-cart/split-shipment behavior | Shipping quotes and tracking |
| D06 | Gateway preference, permitted payment methods including COD if needed, tax-inclusive pricing, invoice fields and approved refund policy | Checkout and accounting |
| D07 | Cancellation and return windows, exclusions, damage evidence, reverse pickup and refund handling | Order support |
| D08 | Staff roles, sign-in methods, guest tracking, review eligibility, moderation and notification providers/templates | Customer and admin workflows |
| D09 | Coupon stacking, merchandising rules, gift wrapping fees, receipts and corporate enquiry routing/statuses | Promotions and gifting |
| D10 | Any branch or archive with unpublished business models, current data/migration status, hosting preferences, analytics goals and expected order/SKU volume | Code audit and stack decision |

## Reference notes

- [Banjara Market Wall Paintings](https://banjaramarket.com/collections/wall-paintings) and [Freedom Tree Wall Art](https://freedomtree.in/collections/wall-art) support exploring a distinct Paintings or Wall Art destination. Confirm the branch against stocked products. Banjara Market's observed collection showed no products, so it served as a navigation reference.
- [Nestasia Décor](https://nestasia.in/collections/decor-banjara-collection) illustrates filters for type, colour, material and price. [Urban Ladder](https://www.urbanladder.com/shipping-policy) provides a PIN-code discovery reference. [AnthroHome](https://www.anthropologie.com/anthrohome/) provides campaign and room-led merchandising references.
- The brief also identifies [Urban Outfitters](https://www.urbanoutfitters.com/) for trend-led discovery, [Zara Home](https://www.zarahome.com/) for photography and material presentation, [H&M Home](https://www2.hm.com/en_in/home.html) for category clarity, [Westwing](https://www.westwing.com/) for room-led commerce, [Ferm Living](https://fermliving.com/) for product detail, and [HAY](https://hay.com/) for colour and functional presentation.
- Additional brief references are [Chumbak](https://www.chumbak.com/) for voice and novelty, [Ellementry](https://www.ellementry.com/) for craft narratives, [The Wishing Chair](https://www.thewishingchair.in/) for whimsical gifting, [Nicobar](https://www.nicobar.com/) for restraint, [India Circus](https://www.indiacircus.com/) for motif-led collections and [Fabindia](https://www.fabindia.com/) for material and provenance storytelling. Use each as a design reference and keep the store's brand distinct.
