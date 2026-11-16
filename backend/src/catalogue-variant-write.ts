import { Prisma, PrismaClient } from '../generated/prisma/client';

export type VariantSelectionInput = { optionId: string; valueId: string };

/** Canonical SKU identity: JSON of [optionId,valueId] pairs sorted by option ID. */
export function combinationKey(selections: VariantSelectionInput[]): string {
  const sorted = [...selections].sort((a, b) => a.optionId.localeCompare(b.optionId));
  if (new Set(sorted.map((s) => s.optionId)).size !== sorted.length) {
    throw new Error('A variant can select only one value per option.');
  }
  return JSON.stringify(sorted.map(({ optionId, valueId }) => [optionId, valueId]));
}

/** Internal transactional path; callers never provide a combination key. */
export async function createCatalogueVariant(
  db: PrismaClient,
  input: { productId: string; sku: string; pricePaise: number; stockQuantity?: number; selections: VariantSelectionInput[] },
) {
  const key = combinationKey(input.selections);
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const values = await tx.productOptionValue.findMany({
      where: { id: { in: input.selections.map((s) => s.valueId) }, productId: input.productId },
      select: { id: true, optionId: true },
    });
    if (values.length !== input.selections.length || input.selections.some((s) =>
      !values.some((v) => v.id === s.valueId && v.optionId === s.optionId))) {
      throw new Error('Variant selections must belong to this product and option.');
    }
    return tx.productVariant.create({ data: {
      productId: input.productId, sku: input.sku, pricePaise: input.pricePaise,
      stockQuantity: input.stockQuantity ?? 0, optionCombinationKey: key,
      selections: { create: input.selections.map((s) => ({ ...s, productId: input.productId })) },
    }, include: { selections: true } });
  });
}
