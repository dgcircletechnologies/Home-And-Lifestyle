import 'reflect-metadata';
import { PrismaService } from './prisma.service';
import { readEnvironment } from './environment';

const categories = ['Lighting', 'Table Décor', 'Soft Furnishings', 'Planters & Greenery', 'Kitchen & Dining'];
const products = ['Amber Pleat Lamp', 'Cobalt Glass Vase', 'Sunday Stripe Cushion', 'Olive Rib Planter', 'Terracotta Serving Bowl', 'Lilac Taper Candle', 'Woven Table Runner', 'Petal Trinket Dish'];
async function main() {
  const url = new URL(readEnvironment().databaseUrl);
  if (!['development', 'test'].includes(process.env.NODE_ENV ?? 'development') || process.env.SEED_DEMO !== 'true' || !['localhost', '127.0.0.1', 'postgres'].includes(url.hostname)) {
    throw Error('Demo seeding requires NODE_ENV=development/test, SEED_DEMO=true, and a local database host.');
  }
  const db = new PrismaService();
  try {
    let categoryCreated = 0; let productCreated = 0; let customerCreated = 0;
    await db.$transaction(async tx => {
      for (const name of categories) {
        const slug = `demo-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const existing = await tx.category.findUnique({ where: { slug } });
        if (!existing) { await tx.category.create({ data: { name, slug, description: `Development demonstration category: ${name}.` } }); categoryCreated++; }
      }
      const categoryRows = await tx.category.findMany({ where: { slug: { startsWith: 'demo-' } } });
      for (const [index, name] of products.entries()) {
        const slug = `demo-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const existing = await tx.product.findUnique({ where: { slug } });
        if (!existing) {
          const category = categoryRows[index % categoryRows.length];
          await tx.product.create({ data: { name, slug, description: `Development demonstration product: ${name}.`, status: index < 6 ? 'PUBLISHED' : 'DRAFT', isFeatured: index < 3, categories: { create: { categoryId: category.id } }, variants: { create: { sku: `DEMO-${String(index + 1).padStart(3, '0')}`, pricePaise: 79900 + index * 10000, stockQuantity: 4 + index, optionCombinationKey: 'default' } } } });
          productCreated++;
        }
      }
      for (let index = 1; index <= 6; index++) {
        const email = `demo-customer-${index}@example.test`;
        const existing = await tx.customer.findUnique({ where: { email } });
        if (!existing) { await tx.customer.create({ data: { email, name: `Demo Customer ${index}` } }); customerCreated++; }
      }
    });
    console.log(`Demo seed complete: categories ${categoryCreated} created, products ${productCreated} created, customers ${customerCreated} created; existing records were skipped.`);
  } finally { await db.$disconnect(); }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Demo seed failed.'); process.exitCode = 1; });
