/* Run only against a fresh disposable database, never DATABASE_URL. */
import pg from 'pg';
import console from 'node:console';
const { Client } = pg;
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import assert from 'node:assert/strict';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.startsWith('/prisma_schema_test_')) {
  throw new Error('TEST_DATABASE_URL must name a fresh prisma_schema_test_* database.');
}
const db = new Client({ connectionString: url });
const migration = name => readFileSync(path.join(__dirname, '../migrations', name, 'migration.sql'), 'utf8');
async function reject(sql, code) {
  await assert.rejects(db.query(sql), e => e.code === code);
}
(async () => {
  await db.connect();
  const tables = await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  assert.equal(tables.rowCount, 0, 'Refusing to use a nonempty database');
  await db.query(migration('20261116000000_init_catalogue'));
  await db.query(`INSERT INTO "Product" (id,name,slug,description,"updatedAt") VALUES ('p','Vase','vase','Original',now());
    INSERT INTO "ProductVariant" (id,"productId",sku,"pricePaise","stockQuantity","optionCombinationKey","updatedAt") VALUES ('v','p','SKU-1',9900,3,'[]',now());`);
  const before = (await db.query('SELECT id,"productId",sku,"pricePaise","stockQuantity","optionCombinationKey","createdAt","updatedAt" FROM "ProductVariant"')).rows;
  await db.query(migration('20261116010000_complete_business_schema'));
  await db.query(migration('20261118000000_admin_categories'));
  await db.query(`INSERT INTO "Customer" (id,"updatedAt") VALUES ('customer',now());
    INSERT INTO "CustomerAddress" (id,"customerId",recipient,phone,line1,city,state,"pinCode") VALUES
    ('address-a','customer','Asha','9876543210','First Road','Pune','Maharashtra','411001'),
    ('address-b','customer','Asha','9876543210','Second Road','Pune','Maharashtra','411001');`);
  await db.query(migration('20261123064652_customer_address_defaults'));
  const addressDefaults = (await db.query(`SELECT id,"isDefault",label FROM "CustomerAddress" ORDER BY id`)).rows;
  assert.deepEqual(addressDefaults, [{ id: 'address-a', isDefault: true, label: null }, { id: 'address-b', isDefault: false, label: null }]);
  await reject(`UPDATE "CustomerAddress" SET "isDefault"=true WHERE id='address-b'`, '23505');
  await db.query(`INSERT INTO "Category" (id,name,slug,"updatedAt") VALUES ('category','Existing category','existing-category',now())`);
  const category = (await db.query(`SELECT status,"deletedAt","imageUrl" FROM "Category" WHERE id='category'`)).rows[0];
  assert.equal(category.status, 'ACTIVE'); assert.equal(category.deletedAt, null); assert.equal(category.imageUrl, null);
  assert.deepEqual((await db.query('SELECT id,"productId",sku,"pricePaise","stockQuantity","optionCombinationKey","createdAt","updatedAt" FROM "ProductVariant"')).rows, before);
  await reject(`UPDATE "ProductVariant" SET "stockQuantity"=-1`, '23514');
  await reject(`UPDATE "ProductVariant" SET "packedWeightGrams"=-1`, '23514');
  await reject(`INSERT INTO "BundleComponent" VALUES ('v','v',1)`, '23514');
  await reject(`INSERT INTO "PinCodeServiceability" ("pinCode",supported,"updatedAt") VALUES ('123',true,now())`, '23514');
  await reject(`INSERT INTO "Coupon" (id,code,kind) VALUES ('bad','BAD','FIXED')`, '23514');
  await db.query(`INSERT INTO "Order" (id,"orderNumber","checkoutKey",email,"deliveryAddress",status,"subtotalPaise","discountPaise","shippingPaise","giftFeePaise","totalPaise","updatedAt")
    VALUES ('o','ORDER-1','checkout-1','guest@example.test','{"line1":"Original address"}','PLACED',9900,0,0,0,9900,now()),
    ('other','ORDER-2','checkout-2','guest@example.test','{}','PLACED',9900,0,0,0,9900,now());
    INSERT INTO "OrderLine" (id,"orderId","variantId","productIdSnapshot","variantIdSnapshot","productName","variantName",sku,quantity,"unitPricePaise","discountPaise","totalPaise","optionsSnapshot","discountsSnapshot")
    VALUES ('line','o','v','p','v','Vase','Blue','SKU-1',1,9900,0,9900,'{}','[]');
    INSERT INTO "Shipment" (id,"orderId",status) VALUES ('s','o','PENDING'),('wrong','other','PENDING');`);
  await reject(`INSERT INTO "ShipmentLine" VALUES ('wrong','line','o',1)`, '23503');
  await db.query(`INSERT INTO "ShipmentLine" ("shipmentId","orderLineId","orderId",quantity) VALUES ('s','line','o',1)`);
  await reject(`INSERT INTO "OrderAdjustment" (id,"orderId","orderLineId",kind,quantity,status,"updatedAt") VALUES ('a','other','line','RETURN',1,'REQUESTED',now())`, '23503');
  await db.query(`INSERT INTO "PaymentAttempt" (id,"orderId",provider,"providerAccount","idempotencyKey","providerPaymentId","amountPaise","updatedAt") VALUES
    ('pay','o','razorpay','test','key','ref',9900,now()),('pay2','o','cashfree','test','key','ref',9900,now()),('pay3','o','razorpay','other-account','key','ref',9900,now());`);
  await reject(`INSERT INTO "PaymentAttempt" (id,"orderId",provider,"providerAccount","idempotencyKey","providerPaymentId","amountPaise","updatedAt") VALUES ('duplicate','o','razorpay','test','new-key','ref',9900,now())`, '23505');
  await db.query(`INSERT INTO "Refund" (id,"paymentId",provider,"providerAccount","idempotencyKey","amountPaise","updatedAt") VALUES ('r','pay','razorpay','test','refund-key',100,now())`);
  await reject(`INSERT INTO "Refund" (id,"paymentId",provider,"providerAccount","idempotencyKey","amountPaise","updatedAt") VALUES ('bad-r','pay','cashfree','test','refund-key',100,now())`, '23503');
  await db.query(`INSERT INTO "PaymentEvent" (id,provider,"providerAccount","providerEventId",payload) VALUES ('event','razorpay','test','evt','{}')`);
  await reject(`INSERT INTO "PaymentEvent" (id,provider,"providerAccount","providerEventId",payload) VALUES ('event2','razorpay','test','evt','{}')`, '23505');
  await reject(`DELETE FROM "PaymentAttempt" WHERE id='pay'`, '23503');
  await reject(`DELETE FROM "Order" WHERE id='o'`, '23503');
  await db.query(`UPDATE "ProductVariant" SET "pricePaise"=12000; DELETE FROM "Product" WHERE id='p'`);
  const line = (await db.query(`SELECT * FROM "OrderLine" WHERE id='line'`)).rows[0];
  assert.equal(line.variantId, null);
  assert.equal(line.unitPricePaise, 9900);
  assert.equal(line.sku, 'SKU-1');
  assert.equal(line.productIdSnapshot, 'p');
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM "Refund"`)).rows[0].n, 1);
  await db.query(`INSERT INTO "CorporateEnquiry" (id,"contactName",email,phone,quantity,"quotationRequested",status,"updatedAt") VALUES ('e','Company','gifting@example.test','123',10,true,'NEW',now())`);
  console.log('PASS: populated baseline upgrade; catalogue preservation; checks; cross-order FKs; provider scope/deduplication; guest purchase snapshots; history retention; independent enquiries.');
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.end());
