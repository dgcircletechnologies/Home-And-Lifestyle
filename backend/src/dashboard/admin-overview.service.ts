import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { period } from './period';

type Range = ReturnType<typeof period>;
type OrderBucket = { bucket: Date; count: bigint };
type MoneyBucket = { bucket: Date; captured: bigint; refunded: bigint };
const number = (value: bigint | number | null | undefined) => Number(value ?? 0);
const successful = ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'];
@Injectable()
export class AdminOverviewService {
  constructor(private readonly db: PrismaService) {}
  private async summary(from: Date, to: Date) {
    const orders = { createdAt: { gte: from, lt: to }, currency: 'INR' };
    const [orderCount, eligible, customers, capture, refund] = await Promise.all([
      this.db.order.count({ where: orders }),
      this.db.order.aggregate({ where: { ...orders, status: { notIn: ['CANCELLED', 'REJECTED'] } }, _sum: { totalPaise: true }, _count: { id: true } }),
      this.db.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: from, lt: to } } }),
      this.db.paymentAttempt.aggregate({ where: { currency: 'INR', status: { in: successful as ('SUCCEEDED' | 'PARTIALLY_REFUNDED' | 'REFUNDED')[] }, updatedAt: { gte: from, lt: to } }, _sum: { amountPaise: true } }),
      this.db.refund.aggregate({ where: { status: 'SUCCEEDED', updatedAt: { gte: from, lt: to }, payment: { currency: 'INR' } }, _sum: { amountPaise: true } }),
    ]);
    const capturedPaise = number(capture._sum.amountPaise); const refundedPaise = number(refund._sum.amountPaise);
    return { orders: orderCount, customers, capturedPaise, refundedPaise, netPaise: capturedPaise - refundedPaise, aovPaise: eligible._count.id ? Math.round(number(eligible._sum.totalPaise) / eligible._count.id) : null };
  }
  async get(range: Range) {
    const { from, to, previousFrom, previousTo, bucket } = range;
    const interval = bucket === 'hour' ? '1 hour' : bucket === 'week' ? '7 days' : '1 day';
    const step = bucket === 'hour' ? 3600000 : bucket === 'week' ? 7 * 86400000 : 86400000;
    const [current, previous, orderRows, paymentRows, statuses, recentOrders, recentCustomers, recentProducts, recentReviews, categoryRows, awaiting, pendingReviews] = await Promise.all([
      this.summary(from, to), this.summary(previousFrom, previousTo),
      this.db.$queryRaw<OrderBucket[]>(Prisma.sql`SELECT date_bin(${interval}::interval, "createdAt", ${from}::timestamptz) AS bucket, count(*)::bigint AS count FROM "Order" WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND currency = 'INR' GROUP BY 1 ORDER BY 1`),
      this.db.$queryRaw<MoneyBucket[]>(Prisma.sql`WITH events AS (SELECT date_bin(${interval}::interval, "updatedAt", ${from}::timestamptz) AS bucket, "amountPaise"::bigint AS captured, 0::bigint AS refunded FROM "PaymentAttempt" WHERE "updatedAt" >= ${from} AND "updatedAt" < ${to} AND currency = 'INR' AND status IN ('SUCCEEDED','PARTIALLY_REFUNDED','REFUNDED') UNION ALL SELECT date_bin(${interval}::interval, r."updatedAt", ${from}::timestamptz), 0::bigint, r."amountPaise"::bigint FROM "Refund" r JOIN "PaymentAttempt" p ON p.id = r."paymentId" WHERE r."updatedAt" >= ${from} AND r."updatedAt" < ${to} AND r.status = 'SUCCEEDED' AND p.currency = 'INR') SELECT bucket, sum(captured)::bigint AS captured, sum(refunded)::bigint AS refunded FROM events GROUP BY bucket ORDER BY bucket`),
      this.db.order.groupBy({ by: ['status'], where: { createdAt: { gte: from, lt: to }, currency: 'INR' }, _count: { id: true }, orderBy: { status: 'asc' } }),
      this.db.order.findMany({ where: { createdAt: { gte: from, lt: to }, currency: 'INR' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 5, select: { id: true, orderNumber: true, createdAt: true, totalPaise: true, currency: true, status: true, email: true, customer: { select: { name: true } }, payments: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { status: true } } } }),
      this.db.user.findMany({ where: { role: 'CUSTOMER', createdAt: { gte: from, lt: to } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 5, select: { id: true, name: true, avatarUrl: true, createdAt: true, emailVerifiedAt: true, disabledAt: true, deletedAt: true } }),
      this.db.product.findMany({ where: { createdAt: { gte: from, lt: to } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 5, select: { id: true, name: true, status: true, createdAt: true, images: { orderBy: [{ position: 'asc' }, { id: 'asc' }], take: 1, select: { url: true } }, categories: { take: 1, select: { category: { select: { name: true } } } } } }),
      this.db.review.findMany({ where: { createdAt: { gte: from, lt: to } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 5, select: { id: true, rating: true, body: true, moderationStatus: true, trashedAt: true, createdAt: true, product: { select: { name: true } }, customer: { select: { name: true, user: { select: { name: true, avatarUrl: true, deletedAt: true } } } } } }),
      this.db.productCategory.groupBy({ by: ['categoryId'], where: { product: { status: { not: 'ARCHIVED' } }, category: { deletedAt: null } }, _count: { productId: true }, orderBy: { _count: { productId: 'desc' } }, take: 8 }),
      this.db.order.count({ where: { status: 'NEW' } }),
      this.db.review.count({ where: { moderationStatus: 'PENDING', trashedAt: null } }),
    ]);
    const categories = await this.db.category.findMany({ where: { id: { in: categoryRows.map(row => row.categoryId) } }, select: { id: true, name: true } });
    const categoryName = new Map(categories.map(row => [row.id, row.name]));
    const orderMap = new Map(orderRows.map(row => [row.bucket.getTime(), number(row.count)]));
    const paymentMap = new Map(paymentRows.map(row => [row.bucket.getTime(), { capturedPaise: number(row.captured), refundedPaise: number(row.refunded) }]));
    const buckets = Array.from({ length: Math.ceil((to.getTime() - from.getTime()) / step) }, (_, index) => {
      const date = new Date(from.getTime() + index * step); const payment = paymentMap.get(date.getTime()) ?? { capturedPaise: 0, refundedPaise: 0 };
      return { date: date.toISOString(), orders: orderMap.get(date.getTime()) ?? 0, ...payment, netPaise: payment.capturedPaise - payment.refundedPaise };
    });
    return { period: { ...range, from: from.toISOString(), to: to.toISOString(), previousFrom: previousFrom.toISOString(), previousTo: previousTo.toISOString(), elapsedTo: range.elapsedTo.toISOString() }, currency: 'INR', refreshedAt: new Date().toISOString(), current, previous, buckets, statuses: statuses.map(row => ({ status: row.status, count: row._count.id })), attention: { awaiting, pendingReviews }, recent: { orders: recentOrders.map(row => ({ ...row, customerName: row.customer?.name ?? row.email, paymentStatus: row.payments[0]?.status ?? null, customer: undefined, payments: undefined, email: undefined })), customers: recentCustomers, products: recentProducts.map(row => ({ id: row.id, name: row.name, status: row.status, createdAt: row.createdAt, thumbnailUrl: row.images[0]?.url ?? null, category: row.categories[0]?.category.name ?? null })), reviews: recentReviews.map(row => ({ id: row.id, rating: row.rating, body: row.body.slice(0, 140), status: row.trashedAt ? 'TRASH' : row.moderationStatus, createdAt: row.createdAt, productName: row.product.name, customerName: row.customer?.user?.deletedAt ? 'Former customer' : row.customer?.user?.name ?? row.customer?.name ?? 'Former customer', avatarUrl: row.customer?.user?.deletedAt ? null : row.customer?.user?.avatarUrl ?? null })) }, categories: categoryRows.map(row => ({ id: row.categoryId, name: categoryName.get(row.categoryId) ?? 'Deleted category', products: row._count.productId })) };
  }
}
