import type { PrismaService } from '../prisma.service';

/** Shared eligibility rules for the public category directory and admin navbar preview. */
export async function categoryVisibility(db: PrismaService) {
  const [categories, assignments] = await Promise.all([
    db.category.findMany({ where: { deletedAt: null }, select: { id: true, name: true, slug: true, parentId: true, status: true, imageUrl: true, showInStorefrontNav: true, storefrontNavPosition: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
    db.productCategory.groupBy({ by: ['categoryId'], where: { product: { status: 'PUBLISHED', variants: { some: {} } } }, _count: { productId: true } }),
  ]);
  const byId = new Map(categories.map(category => [category.id, category]));
  const children = new Map<string, string[]>();
  for (const category of categories) if (category.parentId) children.set(category.parentId, [...(children.get(category.parentId) ?? []), category.id]);
  const direct = new Set(assignments.filter(item => item._count.productId > 0).map(item => item.categoryId));
  const active = new Map<string, boolean>();
  const branch = new Map<string, boolean>();
  const isActive = (id: string, seen = new Set<string>()): boolean => {
    if (active.has(id)) return active.get(id)!;
    const row = byId.get(id);
    if (!row || seen.has(id) || row.status !== 'ACTIVE') return false;
    const result = !row.parentId || isActive(row.parentId, new Set([...seen, id]));
    active.set(id, result); return result;
  };
  const hasProducts = (id: string, seen = new Set<string>()): boolean => {
    if (branch.has(id)) return branch.get(id)!;
    if (!isActive(id) || seen.has(id)) return false;
    const result = direct.has(id) || (children.get(id) ?? []).some(child => hasProducts(child, new Set([...seen, id])));
    branch.set(id, result); return result;
  };
  return { categories, byId, isActive, hasProducts, children };
}

export function branchIds(tree: Awaited<ReturnType<typeof categoryVisibility>>, id: string) {
  const ids: string[] = [];
  const visit = (current: string) => {
    if (!tree.isActive(current)) return;
    ids.push(current);
    for (const child of tree.children.get(current) ?? []) visit(child);
  };
  visit(id); return ids;
}
