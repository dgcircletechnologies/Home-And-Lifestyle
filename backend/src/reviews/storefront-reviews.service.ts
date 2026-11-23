import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { categoryVisibility } from '../categories/category-visibility';

const publicWhere = (productId: string) => ({ productId, moderationStatus: 'APPROVED' as const, trashedAt: null });

@Injectable()
export class StorefrontReviewsService {
  constructor(private readonly db: PrismaService) {}

  private async product(slug: string) {
    const tree = await categoryVisibility(this.db);
    const activeIds = tree.categories.filter(category => tree.isActive(category.id)).map(category => category.id);
    const product = await this.db.product.findFirst({ where: { slug, status: 'PUBLISHED', categories: { some: { categoryId: { in: activeIds } } } }, select: { id: true } });
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
    return product;
  }

  async list(slug: string, page = 1) {
    const product = await this.product(slug);
    const where = publicWhere(product.id);
    const [summary, rows] = await Promise.all([
      this.db.review.aggregate({ where, _count: { rating: true }, _avg: { rating: true } }),
      this.db.review.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 10, take: 10, select: {
        id: true, rating: true, title: true, body: true, createdAt: true, storeReply: true, repliedAt: true, customerId: true,
        customer: { select: { name: true, user: { select: { name: true, avatarUrl: true, deletedAt: true } } } },
      } }),
    ]);
    const customerIds = [...new Set(rows.map(row => row.customerId).filter((id): id is string => Boolean(id)))];
    const purchases = customerIds.length ? await this.db.order.findMany({ where: { customerId: { in: customerIds }, status: { in: ['DELIVERED', 'COMPLETED'] }, lines: { some: { productIdSnapshot: product.id } } }, select: { customerId: true }, distinct: ['customerId'] }) : [];
    const verified = new Set(purchases.map(order => order.customerId));
    return { summary: { averageRating: summary._avg.rating, reviewCount: summary._count.rating }, page, pageSize: 10, items: rows.map(row => ({
      id: row.id, rating: row.rating, title: row.title, body: row.body, createdAt: row.createdAt,
      reviewerName: row.customer?.user?.deletedAt ? 'Former customer' : row.customer?.user?.name ?? row.customer?.name ?? 'Former customer',
      avatarUrl: row.customer?.user?.deletedAt ? null : row.customer?.user?.avatarUrl ?? null,
      verifiedPurchase: row.customerId ? verified.has(row.customerId) : false,
      storeReply: row.storeReply ? { body: row.storeReply, createdAt: row.repliedAt } : null,
    })) };
  }

  async create(slug: string, userId: string, input: { rating: number; title?: string; body: string }) {
    const product = await this.product(slug);
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${userId}), hashtext(${product.id}))`;
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, name: true, customerId: true } });
      if (!user) throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer account not found.' });
      let customerId = user.customerId;
      if (!customerId) {
        const customer = await tx.customer.create({ data: { name: user.name }, select: { id: true } });
        customerId = customer.id;
        await tx.user.update({ where: { id: userId }, data: { customerId } });
      }
      const prior = await tx.review.findFirst({ where: { productId: product.id, customerId }, select: { id: true } });
      if (prior) throw new ConflictException({ code: 'REVIEW_ALREADY_SUBMITTED', message: 'You have already submitted a review for this product.' });
      const review = await tx.review.create({ data: { productId: product.id, customerId, rating: input.rating, title: input.title || null, body: input.body, moderationStatus: 'PENDING' }, select: { id: true, moderationStatus: true } });
      return { ...review, message: 'Thank you. Your review was submitted for approval.' };
    });
  }
}
